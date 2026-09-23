import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { env } from "~/env";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { generateInvoiceNumber } from "~/server/services/invoice.service";
import { anonymizeRegistrationProducts } from "~/server/services/anonymization.service";

const resend = new Resend(env.RESEND_API_KEY);

function getPortalBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? env.BETTER_AUTH_URL;
}

export interface ConfirmPaidRegistrationParams {
  registrationId: string;
  /** Viva transaction id, once the payment has settled. */
  transactionId?: string;
  /** Viva order code the payment was made against. */
  orderCode?: string;
}

export type ConfirmPaidRegistrationResult =
  | { status: "confirmed"; invoiceNumber: string }
  | { status: "already_confirmed" }
  | { status: "not_found" };

/**
 * Marks a registration as paid: assigns an invoice number, anonymises its
 * products for the blind panel, and emails the producer their confirmation.
 *
 * Idempotent — a registration that is already confirmed is left untouched, so
 * a webhook redelivery cannot issue a second invoice number.
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

  const invoiceNumber = await generateInvoiceNumber();

  await db
    .update(schema.registrations)
    .set({
      status: "confirmed",
      paymentTransactionId: transactionId ?? null,
      paymentOrderCode: orderCode ?? registration.paymentOrderCode,
      invoiceNumber,
      invoiceGeneratedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.registrations.id, registrationId));

  console.log(
    `[Payment] Registration ${registrationId} confirmed with invoice ${invoiceNumber}`
  );

  const anonymizedProducts = await anonymizeRegistrationProducts(db, registrationId);
  console.log(
    `[Payment] Anonymized ${anonymizedProducts.length} products for registration ${registrationId}`
  );

  const producerEmail = registration.producer.user.email;

  if (producerEmail) {
    const portalBaseUrl = getPortalBaseUrl();
    await sendRegistrationConfirmationEmail({
      email: producerEmail,
      name: registration.producer.user.name ?? registration.producer.companyName,
      cupName: registration.cup.name,
      productCount: registration.products.length,
      amountPaid: `${(registration.totalAmount / 100).toFixed(2)} ${
        registration.currency?.toUpperCase() ?? "EUR"
      }`,
      invoiceNumber,
      invoiceUrl: `${portalBaseUrl}/api/invoices/${registrationId}`,
      portalBaseUrl,
    });
  }

  return { status: "confirmed", invoiceNumber };
}

/**
 * Send registration confirmation email to producer.
 */
async function sendRegistrationConfirmationEmail(params: {
  email: string;
  name: string;
  cupName: string;
  productCount: number;
  amountPaid: string;
  invoiceNumber: string;
  invoiceUrl: string;
  portalBaseUrl: string;
}) {
  const {
    email,
    name,
    cupName,
    productCount,
    amountPaid,
    invoiceNumber,
    invoiceUrl,
    portalBaseUrl,
  } = params;

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

  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: email,
      subject: `Inscription confirmée - ${cupName}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #d4af37; font-size: 32px; margin: 0;">
              Platinum CBD Cup
            </h1>
          </div>

          <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">
            Inscription confirmée
          </h2>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Bonjour ${name},
          </p>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Votre inscription à <strong>${cupName}</strong> a été confirmée avec succès.
          </p>

          <div style="background-color: #f0fdf4; border-radius: 8px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #22c55e;">
            <p style="color: #166534; font-size: 16px; margin: 0 0 8px 0;"><strong>Produits inscrits :</strong> ${productCount} produit(s)</p>
            <p style="color: #166534; font-size: 16px; margin: 0 0 8px 0;"><strong>Montant réglé :</strong> ${amountPaid}</p>
            <p style="color: #166534; font-size: 16px; margin: 0;"><strong>Facture :</strong> ${invoiceNumber}</p>
          </div>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Vous recevrez prochainement les instructions pour l'envoi de vos échantillons.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalBaseUrl}/producer/registrations" style="display: inline-block; background-color: #d4af37; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Voir mes inscriptions
            </a>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${invoiceUrl}" style="color: #d4af37; font-size: 14px; text-decoration: underline;">
              Télécharger ma facture (PDF)
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Platinum CBD Cup
          </p>
        </div>
      `,
    });

    if (result.error) {
      console.error("[Payment] Failed to send registration confirmation email:", result.error);
    } else {
      console.log("[Payment] Registration confirmation email sent successfully");
    }
  } catch (error) {
    console.error("[Payment] Failed to send registration confirmation email:", error);
    // Don't throw - an email failure must not undo a confirmed payment.
  }
}
