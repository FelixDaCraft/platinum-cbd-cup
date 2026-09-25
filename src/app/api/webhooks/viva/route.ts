import { NextResponse } from "next/server";

import { getTransaction, getWebhookVerificationKey } from "~/lib/viva";
import {
  confirmPaidRegistration,
  PaymentVerificationError,
} from "~/server/services/registration-payment.service";

/**
 * Viva.com webhook for producer registration payments.
 *
 * Viva verifies ownership of a webhook URL by issuing a GET and expecting the
 * merchant's verification key back, so both verbs are implemented here.
 *
 * Viva does not sign its webhook payloads. The POST body is therefore treated
 * as an untrusted *notification*: it only tells us which transaction to look
 * at, and the payment is always re-read from the Viva API before a
 * registration is marked as paid.
 */

/** "Transaction Payment Created" — the only event this endpoint acts on. */
const TRANSACTION_PAYMENT_CREATED = 1796;

/** Viva status id for a settled payment. */
const STATUS_FINISHED = "F";

/**
 * Garde-fou anti-amplification : l'endpoint est forcément public (Viva ne
 * signe pas et ne s'authentifie pas), et chaque POST accepté déclenche un GET
 * vers l'API Viva. Sans limite, un POST en boucle ferait marteler l'API Viva
 * depuis notre IP, au risque d'un blocage du compte marchand.
 *
 * Fenêtre glissante en mémoire : suffisante pour un déploiement mono-instance,
 * et complémentaire d'un filtrage par IP source côté Cloudflare.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_IP = 30;
const RATE_LIMIT_MAX_TOTAL = 120;

const recentRequests = new Map<string, number[]>();

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  let total = 0;
  for (const [key, timestamps] of recentRequests) {
    const kept = timestamps.filter((timestamp) => timestamp > cutoff);
    if (kept.length === 0) {
      recentRequests.delete(key);
      continue;
    }
    recentRequests.set(key, kept);
    total += kept.length;
  }

  const forIp = recentRequests.get(ip) ?? [];
  if (forIp.length >= RATE_LIMIT_MAX_PER_IP || total >= RATE_LIMIT_MAX_TOTAL) {
    return true;
  }

  recentRequests.set(ip, [...forIp, now]);
  return false;
}

/**
 * Cache mémoire de la clé de vérification.
 *
 * Viva n'appelle ce GET qu'à l'enregistrement de l'URL, mais l'endpoint est
 * public : sans cache, chaque GET anonyme déclenchait un OAuth + un appel
 * `/api/messages/config/token` chez Viva. La clé est stable pour un compte
 * marchand, une heure de cache est donc large et supprime l'amplification.
 */
const VERIFICATION_KEY_TTL_MS = 60 * 60 * 1000;
let cachedVerificationKey: { key: string; expiresAt: number } | null = null;

export async function GET(request: Request) {
  const ip = clientIp(request);

  // Même garde-fou que le POST : le GET déclenche lui aussi un appel sortant
  // vers Viva lors du premier passage (et après expiration du cache).
  if (isRateLimited(ip)) {
    console.warn(`[Viva Webhook] Rate limit hit for ${ip} (GET)`);
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const now = Date.now();
  if (cachedVerificationKey && now < cachedVerificationKey.expiresAt) {
    return NextResponse.json({ Key: cachedVerificationKey.key });
  }

  try {
    const key = await getWebhookVerificationKey();
    cachedVerificationKey = { key, expiresAt: now + VERIFICATION_KEY_TTL_MS };
    return NextResponse.json({ Key: key });
  } catch (error) {
    console.error("[Viva Webhook] Verification key lookup failed:", error);
    return NextResponse.json(
      { error: "Viva verification key unavailable" },
      { status: 500 }
    );
  }
}

interface VivaWebhookBody {
  EventTypeId?: number;
  EventData?: {
    TransactionId?: string;
    OrderCode?: number | string;
    StatusId?: string;
    MerchantTrns?: string;
    Amount?: number;
  };
}

export async function POST(request: Request) {
  const ip = clientIp(request);

  if (isRateLimited(ip)) {
    console.warn(`[Viva Webhook] Rate limit hit for ${ip}`);
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: VivaWebhookBody;

  try {
    body = (await request.json()) as VivaWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventTypeId = body.EventTypeId;
  console.log(`[Viva Webhook] Received event: ${eventTypeId ?? "unknown"}`);

  if (eventTypeId !== TRANSACTION_PAYMENT_CREATED) {
    // Acknowledge anything else so Viva stops retrying it.
    return NextResponse.json({ received: true });
  }

  const transactionId = body.EventData?.TransactionId;

  if (!transactionId) {
    console.error("[Viva Webhook] Payment event without TransactionId");
    return NextResponse.json({ error: "Missing TransactionId" }, { status: 400 });
  }

  try {
    // Never trust the notification body: read the transaction back from Viva.
    const transaction = await getTransaction(transactionId);

    if (transaction.statusId !== STATUS_FINISHED) {
      console.log(
        `[Viva Webhook] Transaction ${transactionId} is ${transaction.statusId}, not settled — ignoring`
      );
      return NextResponse.json({ received: true });
    }

    // `merchantTrns` is the registration id we set when creating the order.
    const registrationId = transaction.merchantTrns;

    if (!registrationId) {
      console.error(
        `[Viva Webhook] Transaction ${transactionId} carries no merchantTrns, cannot match a registration`
      );
      return NextResponse.json({ error: "Unmatched transaction" }, { status: 400 });
    }

    const result = await confirmPaidRegistration({
      registrationId,
      transactionId: transaction.transactionId,
      orderCode: transaction.orderCode,
      // Viva renvoie un décimal dans la devise de la commande.
      amount: transaction.amount,
    });

    if (result.status === "not_found") {
      // 200 on purpose: retrying will not make the registration appear.
      console.error(`[Viva Webhook] No registration ${registrationId} for transaction ${transactionId}`);
      return NextResponse.json({ received: true, matched: false });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      // Le paiement ne correspond pas à l'inscription : réessayer n'y changera
      // rien, on accuse réception pour couper les redéliveries et on trace.
      console.error(
        `[Viva Webhook] Payment verification failed (${error.reason}) for transaction ${transactionId}: ${error.message}`
      );
      return NextResponse.json({ received: true, matched: false });
    }

    console.error("[Viva Webhook] Error processing event:", error);
    // 500 so Viva retries — the payment did happen, we just failed to record it.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
