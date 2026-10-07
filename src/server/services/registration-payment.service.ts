import { eq } from "drizzle-orm";

import { env } from "~/env";
import { getTransaction } from "~/lib/viva";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { allocateInvoiceNumber } from "~/server/services/invoice.service";
import { anonymizeRegistrationProducts } from "~/server/services/anonymization.service";
import { getPortalBaseUrl } from "~/server/services/app-url";
import {
  escapeHtml,
  renderButton,
  renderCallout,
  renderEmailLayout,
  renderGreeting,
  renderParagraph,
  sendEmail,
} from "~/server/services/email";

export interface ConfirmPaidRegistrationParams {
  registrationId: string;
  /** Viva transaction id, once the payment has settled. */
  transactionId?: string;
  /** Viva order code the payment was made against. */
  orderCode?: string;
  /**
   * Montant réglé, tel que Viva le renvoie : en unités de la devise (49.9),
   * pas en centimes. Omis, il est relu chez Viva à partir de `transactionId`.
   */
  amount?: number;
}

export type ConfirmPaidRegistrationResult =
  | { status: "confirmed"; invoiceNumber: string }
  | { status: "already_confirmed" }
  | { status: "not_found" };

export type PaymentVerificationReason =
  | "missing_order_code"
  | "order_code_mismatch"
  | "amount_mismatch"
  | "amount_unknown";

/**
 * Le paiement lu chez Viva ne correspond pas à l'inscription qu'il prétend
 * régler. Volontairement levée plutôt que renvoyée comme statut : aucun
 * appelant ne doit pouvoir confirmer une inscription en ignorant l'écart.
 */
export class PaymentVerificationError extends Error {
  constructor(
    readonly reason: PaymentVerificationReason,
    message: string
  ) {
    super(message);
    this.name = "PaymentVerificationError";
  }
}

/**
 * Compare le paiement à l'inscription qu'il est censé régler.
 *
 * Deux écarts sont possibles et tous deux bloquants :
 *  - l'orderCode payé n'est pas celui créé pour cette inscription (paiement
 *    d'une autre commande rattaché ici via `merchantTrns`) ;
 *  - le montant encaissé ne couvre pas le total de l'inscription. Le producteur
 *    peut ajouter des produits entre la création de la commande et le paiement
 *    (`addProduct` reste ouvert tant que l'inscription est `pending_payment`),
 *    ce qui laisserait confirmer dix produits pour le prix d'un.
 */
function assertPaymentMatchesRegistration(params: {
  registrationId: string;
  expectedOrderCode: string | null;
  expectedAmountInCents: number;
  orderCode: string | undefined;
  paidAmountInCents: number | null;
}): void {
  const {
    registrationId,
    expectedOrderCode,
    expectedAmountInCents,
    orderCode,
    paidAmountInCents,
  } = params;

  if (!expectedOrderCode) {
    throw new PaymentVerificationError(
      "missing_order_code",
      `Inscription ${registrationId} sans commande de paiement enregistrée : impossible de rattacher un paiement.`
    );
  }

  if (!orderCode || orderCode !== expectedOrderCode) {
    throw new PaymentVerificationError(
      "order_code_mismatch",
      `Inscription ${registrationId} : commande payée ${orderCode ?? "inconnue"} != commande attendue ${expectedOrderCode}.`
    );
  }

  if (paidAmountInCents === null) {
    throw new PaymentVerificationError(
      "amount_unknown",
      `Inscription ${registrationId} : montant du paiement inconnu, confirmation refusée.`
    );
  }

  if (paidAmountInCents !== expectedAmountInCents) {
    throw new PaymentVerificationError(
      "amount_mismatch",
      `Inscription ${registrationId} : montant payé ${paidAmountInCents} centimes != total attendu ${expectedAmountInCents} centimes.`
    );
  }
}

/**
 * Marque une inscription comme payée : numéro de facture, anonymisation des
 * produits pour le jury à l'aveugle, email de confirmation au producteur.
 *
 * Tout ce qui touche la base se fait dans une seule transaction : une
 * inscription confirmée dont les produits resteraient identifiables, ou dont
 * la facture ne serait pas numérotée, n'est pas un état acceptable.
 *
 * Idempotent, y compris en concurrence : le webhook et la page de retour du
 * navigateur s'exécutent en parallèle. La ligne d'inscription est verrouillée
 * (`FOR UPDATE`) et son statut relu sous ce verrou, si bien que le second
 * appelant repart sur `already_confirmed`.
 *
 * Lève `PaymentVerificationError` si le paiement ne correspond pas à
 * l'inscription (commande ou montant).
 */
export async function confirmPaidRegistration(
  params: ConfirmPaidRegistrationParams
): Promise<ConfirmPaidRegistrationResult> {
  const { registrationId, transactionId, orderCode } = params;

  const registration = await db.query.registrations.findFirst({
    where: (reg, { eq: eqFn }) => eqFn(reg.id, registrationId),
    with: {
      producer: { with: { user: true } },
      cup: { columns: { name: true } },
      products: { columns: { id: true } },
    },
  });

  if (!registration) {
    console.error(`[Payment] Registration ${registrationId} not found`);
    return { status: "not_found" };
  }

  if (registration.status === "confirmed") {
    console.log(`[Payment] Registration ${registrationId} already confirmed, skipping`);
    return { status: "already_confirmed" };
  }

  // Le montant est relu chez Viva quand l'appelant ne l'a pas déjà en main,
  // hors transaction : aucun appel réseau ne doit se faire sous verrou.
  const paidAmountInCents = await resolvePaidAmountInCents(params);

  const result = await db.transaction(async (tx) => {
    // Verrou de ligne : la confirmation concurrente (webhook + retour navigateur)
    // attend ici, puis relit un statut deja `confirmed`.
    const [locked] = await tx
      .select({
        status: schema.registrations.status,
        totalAmount: schema.registrations.totalAmount,
        paymentOrderCode: schema.registrations.paymentOrderCode,
      })
      .from(schema.registrations)
      .where(eq(schema.registrations.id, registrationId))
      .for("update");

    if (!locked) {
      return { status: "not_found" } as const;
    }

    if (locked.status === "confirmed") {
      console.log(`[Payment] Registration ${registrationId} already confirmed, skipping`);
      return { status: "already_confirmed" } as const;
    }

    // Relu sous verrou : le total a pu changer depuis la lecture ci-dessus.
    assertPaymentMatchesRegistration({
      registrationId,
      expectedOrderCode: locked.paymentOrderCode,
      expectedAmountInCents: locked.totalAmount,
      orderCode,
      paidAmountInCents,
    });

    const now = new Date();
    const invoiceNumber = await allocateInvoiceNumber(tx, registrationId, now);

    await tx
      .update(schema.registrations)
      .set({
        status: "confirmed",
        paymentTransactionId: transactionId ?? null,
        // La place est désormais occupée par un produit payé : la réservation
        // n'a plus d'objet.
        paymentReservedUntil: null,
        updatedAt: now,
      })
      .where(eq(schema.registrations.id, registrationId));

    // Dans la transaction : une inscription confirmée dont les produits ne
    // seraient pas anonymisés serait visible en clair par le jury.
    const anonymizedProducts = await anonymizeRegistrationProducts(
      tx as unknown as typeof db,
      registrationId
    );
    console.log(
      `[Payment] Anonymized ${anonymizedProducts.length} products for registration ${registrationId}`
    );

    return {
      status: "confirmed",
      invoiceNumber,
      amountInCents: locked.totalAmount,
    } as const;
  });

  if (result.status !== "confirmed") {
    return result;
  }

  console.log(
    `[Payment] Registration ${registrationId} confirmed with invoice ${result.invoiceNumber}`
  );

  const producerEmail = registration.producer.user.email;

  if (producerEmail) {
    await sendRegistrationConfirmationEmail({
      email: producerEmail,
      name: registration.producer.user.name ?? registration.producer.companyName,
      cupName: registration.cup.name,
      registrationId,
      productCount: registration.products.length,
      amountPaid: `${(result.amountInCents / 100).toFixed(2)} ${
        registration.currency?.toUpperCase() ?? "EUR"
      }`,
      invoiceNumber: result.invoiceNumber,
    });
  }

  return { status: "confirmed", invoiceNumber: result.invoiceNumber };
}

/**
 * Montant réglé en centimes. Viva renvoie un décimal dans la devise de la
 * commande ; la base stocke des centimes entiers.
 */
async function resolvePaidAmountInCents(
  params: ConfirmPaidRegistrationParams
): Promise<number | null> {
  if (params.amount !== undefined) {
    return Math.round(params.amount * 100);
  }

  if (!params.transactionId) {
    return null;
  }

  const transaction = await getTransaction(params.transactionId);
  return Math.round(transaction.amount * 100);
}

/**
 * Envoie la confirmation d'inscription au producteur.
 *
 * Aucune erreur ne remonte : l'inscription est déjà confirmée et payée, un
 * email raté ne doit pas faire échouer le webhook (qui serait alors rejoué).
 * La construction des URL est incluse dans le `try` pour la même raison.
 */
async function sendRegistrationConfirmationEmail(params: {
  email: string;
  name: string;
  cupName: string;
  registrationId: string;
  productCount: number;
  amountPaid: string;
  invoiceNumber: string;
}) {
  const { email, name, cupName, registrationId, productCount, amountPaid, invoiceNumber } =
    params;

  try {
    const portalBaseUrl = getPortalBaseUrl();
    const invoiceUrl = `${portalBaseUrl}/api/invoices/${registrationId}`;

    if (env.NODE_ENV === "development") {
      console.log("\n" + "=".repeat(60));
      console.log("EMAIL CONFIRMATION INSCRIPTION PRODUCTEUR (DEV MODE)");
      console.log("=".repeat(60));
      console.log("To:", email);
      console.log("Cup:", cupName);
      console.log("Products:", productCount);
      console.log("Amount:", amountPaid);
      console.log("Invoice:", invoiceNumber, invoiceUrl);
      console.log("=".repeat(60) + "\n");
    }

    await sendEmail({
      scope: "Payment",
      ref: `registration ${registrationId}`,
      to: email,
      subject: `Inscription confirmée - ${cupName}`,
      html: renderEmailLayout({
        title: "Inscription confirmée",
        body: `
      ${renderGreeting(name)}
      ${renderParagraph(`Votre inscription à <strong>${escapeHtml(cupName)}</strong> a été confirmée avec succès.`)}
      ${renderCallout({
        content: `<strong>Produits inscrits :</strong> ${productCount} produit(s)
            <br />
            <strong>Montant réglé :</strong> ${escapeHtml(amountPaid)}
            <br />
            <strong>Facture :</strong> ${escapeHtml(invoiceNumber)}`,
        background: "#f0fdf4",
        textColor: "#166534",
        borderColor: "#22c55e",
      })}
      ${renderParagraph("Vous recevrez prochainement les instructions pour l'envoi de vos échantillons.")}
      ${renderButton(`${portalBaseUrl}/producer/registrations`, "Voir mes inscriptions")}

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${invoiceUrl}" style="color: #d4af37; font-size: 14px; text-decoration: underline;">
              Télécharger ma facture (PDF)
            </a>
          </div>`,
        footerHtml: "Platinum CBD Cup",
      }),
    });
  } catch (error) {
    console.error("[Payment] Failed to send registration confirmation email:", error);
    // Ne jamais relancer : un échec d'email ne doit pas défaire un paiement confirmé.
  }
}
