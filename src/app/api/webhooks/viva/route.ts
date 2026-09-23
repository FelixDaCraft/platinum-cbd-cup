import { NextResponse } from "next/server";

import { getTransaction, getWebhookVerificationKey } from "~/lib/viva";
import { confirmPaidRegistration } from "~/server/services/registration-payment.service";

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

export async function GET() {
  try {
    const key = await getWebhookVerificationKey();
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
    });

    if (result.status === "not_found") {
      // 200 on purpose: retrying will not make the registration appear.
      console.error(`[Viva Webhook] No registration ${registrationId} for transaction ${transactionId}`);
      return NextResponse.json({ received: true, matched: false });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Viva Webhook] Error processing event:", error);
    // 500 so Viva retries — the payment did happen, we just failed to record it.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
