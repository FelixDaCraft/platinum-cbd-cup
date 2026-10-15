/**
 * Rattrape l'historique de paiement des inscriptions non abouties.
 *
 * Contexte : avant le suivi des tentatives (`payment_attempts`,
 * `last_payment_*`), rien ne disait pourquoi une inscription restait en
 * attente : `payment_order_code` est effacé au retour de la page d'échec et à
 * chaque modification du panier. Viva, lui, garde toutes les transactions, y
 * compris les refus, rattachées à l'inscription par `MerchantTrns` (l'id de
 * l'inscription, posé à la création de la commande).
 *
 * Le script relit chez Viva les transactions de chaque jour depuis la plus
 * ancienne inscription en attente, puis, par inscription :
 *   - compte les commandes payées ou tentées et date la dernière tentative ;
 *   - trace le dernier refus (StatusId E) et son motif s'il est fourni ;
 *   - SIGNALE toute transaction réussie (StatusId F) sur une inscription
 *     restée en attente : un paiement encaissé jamais confirmé, à traiter à
 *     la main. Le script ne confirme rien lui-même.
 *
 * Une commande ouverte puis abandonnée avant toute saisie de carte ne laisse
 * aucune transaction : elle reste invisible ici.
 *
 * Usage (depuis la racine du projet, .env chargé) :
 *   pnpm tsx scripts/backfill-payment-history.ts                  # dry-run
 *   pnpm tsx scripts/backfill-payment-history.ts --apply          # écrit
 *   pnpm tsx scripts/backfill-payment-history.ts --since=2026-09-01
 *
 * Écrire suppose la migration 0015_suivi_paiement appliquée. Le dry-run ne lit
 * que des colonnes antérieures : il peut tourner avant le déploiement.
 */

import { Pool } from "pg";
import { config } from "dotenv";

config();

const APPLY = process.argv.includes("--apply");
const sinceArg = process.argv.find((a) => a.startsWith("--since="))?.split("=")[1];

const {
  DATABASE_URL,
  VIVA_MERCHANT_ID,
  VIVA_API_KEY,
  VIVA_ENV = "production",
} = process.env;

if (!DATABASE_URL || !VIVA_MERCHANT_ID || !VIVA_API_KEY) {
  console.error("DATABASE_URL, VIVA_MERCHANT_ID et VIVA_API_KEY sont requis.");
  process.exit(1);
}

const VIVA_HOST =
  VIVA_ENV === "demo" ? "https://demo.vivapayments.com" : "https://www.vivapayments.com";
const AUTH = `Basic ${Buffer.from(`${VIVA_MERCHANT_ID}:${VIVA_API_KEY}`).toString("base64")}`;

interface VivaTransaction {
  TransactionId?: string;
  StatusId?: string;
  InsDate?: string;
  MerchantTrns?: string | null;
  OrderCode?: number | string;
  Order?: { OrderCode?: number | string };
  Amount?: number;
  ResponseEventId?: number | null;
  EventId?: number | null;
  [key: string]: unknown;
}

interface PendingRegistration {
  id: string;
  created_at: Date;
  cup_name: string;
  producer: string;
  product_count: number;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function fetchDay(date: string): Promise<VivaTransaction[]> {
  const response = await fetch(`${VIVA_HOST}/api/transactions/?date=${date}`, {
    headers: { Authorization: AUTH },
  });
  if (!response.ok) {
    throw new Error(`Viva ${date} : ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const data = (await response.json()) as { Transactions?: VivaTransaction[] };
  return data.Transactions ?? [];
}

const orderCodeOf = (t: VivaTransaction) => String(t.OrderCode ?? t.Order?.OrderCode ?? "");

/** Motif du refus, sous le nom que Viva lui donne dans cette API. */
function failureCodeOf(t: VivaTransaction): string | null {
  const code = t.ResponseEventId ?? t.EventId;
  return code && code !== 0 ? String(code) : null;
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const { rows: pending } = await pool.query<PendingRegistration>(`
      select r.id, r.created_at, c.name as cup_name,
             coalesce(p.brand_name, p.company_name) as producer,
             (select count(*)::int from products pr where pr.registration_id = r.id) as product_count
      from registrations r
      join cups c on c.id = r.cup_id
      join producers p on p.id = r.producer_id
      where r.status = 'pending_payment'
      order by r.created_at`);

    if (pending.length === 0) {
      console.log("Aucune inscription en attente.");
      return;
    }

    const byId = new Map(pending.map((r) => [r.id, r]));
    const start = sinceArg ? new Date(sinceArg) : pending[0]!.created_at;
    const days: string[] = [];
    for (const d = new Date(ymd(start)); d <= new Date(); d.setUTCDate(d.getUTCDate() + 1)) {
      days.push(ymd(d));
    }

    console.log(
      `${pending.length} inscription(s) en attente, transactions Viva du ${days[0]} au ${days.at(-1)}…`
    );

    const txByRegistration = new Map<string, VivaTransaction[]>();
    let sampleFailure: VivaTransaction | undefined;

    for (const day of days) {
      const dayTxs = await fetchDay(day);
      // Résumé du jour : vérifie que l'API remonte bien les transactions de la
      // source (paiements confirmés compris) avant de conclure à leur absence.
      const statuses = dayTxs.reduce<Record<string, number>>((acc, t) => {
        const key = t.StatusId ?? "?";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
      console.log(
        `  ${day} : ${dayTxs.length} transaction(s) ${JSON.stringify(statuses)}, ` +
          `${dayTxs.filter((t) => t.MerchantTrns).length} avec MerchantTrns`
      );
      for (const t of dayTxs) {
        if (!t.MerchantTrns || !byId.has(t.MerchantTrns)) continue;
        if (t.StatusId === "E") sampleFailure ??= t;
        const list = txByRegistration.get(t.MerchantTrns) ?? [];
        list.push(t);
        txByRegistration.set(t.MerchantTrns, list);
      }
    }

    // Champs réellement renvoyés pour un refus : sert à vérifier où Viva met
    // le motif. Ni carte ni identité ne sont affichées.
    if (sampleFailure) {
      console.log("\nChamps d'un refus Viva :", Object.keys(sampleFailure).sort().join(", "));
    }

    const unconfirmedPayments: string[] = [];
    const updates: {
      id: string;
      attempts: number;
      lastAttemptAt: Date;
      failureAt: Date | null;
      failureCode: string | null;
    }[] = [];

    console.log("");
    for (const reg of pending) {
      const txs = (txByRegistration.get(reg.id) ?? []).sort((a, b) =>
        String(a.InsDate).localeCompare(String(b.InsDate))
      );
      const label = `${reg.producer} — ${reg.cup_name} (${reg.product_count} produit(s))`;

      if (txs.length === 0) {
        console.log(`  ·  ${label} : aucune transaction Viva`);
        continue;
      }

      const paid = txs.filter((t) => t.StatusId === "F");
      if (paid.length > 0) {
        unconfirmedPayments.push(
          `${label} : ${paid.map((t) => `${t.TransactionId} (${t.Amount} €, ${t.InsDate})`).join(", ")}`
        );
      }

      const last = txs.at(-1)!;
      const lastFailure = [...txs].reverse().find((t) => t.StatusId === "E");
      const attempts = new Set(txs.map(orderCodeOf).filter(Boolean)).size || txs.length;
      const failureCode = lastFailure ? failureCodeOf(lastFailure) : null;

      console.log(
        `  ${lastFailure ? "✗" : "?"}  ${label} : ${txs.length} transaction(s), ` +
          `${attempts} commande(s), dernière ${last.InsDate} [${last.StatusId}]` +
          (lastFailure ? `, refus ${lastFailure.InsDate}${failureCode ? ` motif ${failureCode}` : ""}` : "")
      );

      updates.push({
        id: reg.id,
        attempts,
        lastAttemptAt: new Date(String(last.InsDate)),
        failureAt: lastFailure ? new Date(String(lastFailure.InsDate)) : null,
        failureCode,
      });
    }

    if (unconfirmedPayments.length > 0) {
      console.log("\n⚠ PAIEMENTS RÉUSSIS SUR DES INSCRIPTIONS ENCORE EN ATTENTE (à vérifier) :");
      for (const line of unconfirmedPayments) console.log(`  - ${line}`);
    }

    console.log(`\n${updates.length} inscription(s) à mettre à jour.`);

    if (!APPLY) {
      console.log("Dry-run : rien n'est écrit. Relancer avec --apply.");
      return;
    }

    // Ne fait que compléter : on ne recule ni un compteur ni une date déjà
    // posés par le suivi en direct.
    for (const u of updates) {
      await pool.query(
        `update registrations set
           payment_attempts = greatest(payment_attempts, $2),
           last_payment_attempt_at = greatest(coalesce(last_payment_attempt_at, $3), $3),
           last_payment_failure_at = case
             when $4::timestamptz is not null
              and (last_payment_failure_at is null or last_payment_failure_at < $4)
             then $4 else last_payment_failure_at end,
           last_payment_failure_code = case
             when $4::timestamptz is not null
              and (last_payment_failure_at is null or last_payment_failure_at < $4)
             then $5 else last_payment_failure_code end
         where id = $1 and status = 'pending_payment'`,
        [u.id, u.attempts, u.lastAttemptAt, u.failureAt, u.failureCode]
      );
    }
    console.log(`${updates.length} inscription(s) mise(s) à jour.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
