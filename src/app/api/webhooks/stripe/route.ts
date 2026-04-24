import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Resend } from "resend";
import { eq } from "drizzle-orm";

import { stripe } from "~/lib/stripe";
import { env } from "~/env";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { generateInvoiceNumber } from "~/server/services/invoice.service";
import { anonymizeRegistrationProducts } from "~/server/services/anonymization.service";

const resend = new Resend(env.RESEND_API_KEY);

/**
 * Return the single-tenant public base URL for portal links.
 */
function getPortalBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? env.BETTER_AUTH_URL;
}

/**
 * Stripe Webhook Handler (single-tenant)
 *
 * Only keeps the producer registration payment flow. SaaS subscription
 * events (checkout `organizer_signup`/`organizer_upgrade`,
 * `customer.subscription.*`, `invoice.*`) and the Stripe Connect
 * `account.updated` event have been removed: there is no organizations
 * table nor platform-level Stripe Connect config to sync against anymore.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    console.error("[Stripe Webhook] Missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Signature verification failed:", errorMessage);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${errorMessage}` },
      { status: 400 }
    );
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.metadata?.type === "producer_registration") {
          await handleProducerRegistrationPayment(session);
        } else {
          console.log(
            `[Stripe Webhook] Ignoring checkout session of type: ${session.metadata?.type ?? "unknown"}`
          );
        }
        break;
      }
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error processing event:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle producer registration payment completed.
 * Updates the registration to confirmed, anonymizes products, and sends a
 * confirmation email with an invoice link.
 */
async function handleProducerRegistrationPayment(session: Stripe.Checkout.Session) {
  console.log("[Stripe Webhook] Processing producer_registration payment");

  // Verify payment was successful
  if (session.payment_status !== "paid") {
    console.log(`[Stripe Webhook] Payment status is ${session.payment_status}, not processing`);
    return;
  }

  const { registrationId } = session.metadata ?? {};

  if (!registrationId) {
    throw new Error("Missing registrationId in checkout session metadata");
  }

  // Get registration
  const registration = await db.query.registrations.findFirst({
    where: (reg, { eq: eqFn }) => eqFn(reg.id, registrationId),
    with: {
      producer: {
        with: {
          user: true,
        },
      },
      cup: {
        columns: {
          name: true,
        },
      },
      products: {
        columns: {
          id: true,
        },
      },
    },
  });

  if (!registration) {
    console.error(`[Stripe Webhook] Registration ${registrationId} not found`);
    return;
  }

  // Already confirmed (idempotency)
  if (registration.status === "confirmed") {
    console.log("[Stripe Webhook] Registration already confirmed, skipping");
    return;
  }

  // Generate unique invoice number
  const invoiceNumber = await generateInvoiceNumber();

  // Update registration status to confirmed with invoice info
  await db
    .update(schema.registrations)
    .set({
      status: "confirmed",
      stripePaymentIntentId: session.payment_intent as string | null,
      invoiceNumber,
      invoiceGeneratedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.registrations.id, registrationId));

  console.log(`[Stripe Webhook] Registration ${registrationId} confirmed with invoice ${invoiceNumber}`);

  // Anonymize all products in this registration
  const anonymizedProducts = await anonymizeRegistrationProducts(db, registrationId);
  console.log(`[Stripe Webhook] Anonymized ${anonymizedProducts.length} products for registration ${registrationId}`);

  // Send confirmation email with invoice link
  const producerEmail = registration.producer.user.email;
  const producerName = registration.producer.user.name ?? registration.producer.companyName;
  const cupName = registration.cup.name;
  const productCount = registration.products.length;
  const amountPaid = (registration.totalAmount / 100).toFixed(2);
  const currency = registration.currency?.toUpperCase() ?? "EUR";
  const portalBaseUrl = getPortalBaseUrl();
  const invoiceUrl = `${portalBaseUrl}/api/invoices/${registrationId}`;

  if (producerEmail) {
    await sendRegistrationConfirmationEmail({
      email: producerEmail,
      name: producerName,
      cupName,
      productCount,
      amountPaid: `${amountPaid} ${currency}`,
      invoiceNumber,
      invoiceUrl,
      portalBaseUrl,
    });
  }
}

/**
 * Send registration confirmation email to producer
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
  const { email, name, cupName, productCount, amountPaid, invoiceNumber, invoiceUrl, portalBaseUrl } = params;

  // Log en dev pour faciliter les tests
  if (env.NODE_ENV === "development") {
    console.log("\n" + "=".repeat(60));
    console.log("EMAIL CONFIRMATION INSCRIPTION PRODUCTEUR (DEV MODE)");
    console.log("=".repeat(60));
    console.log("To:", email);
    console.log("Name:", name);
    console.log("Cup:", cupName);
    console.log("Products:", productCount);
    console.log("Amount:", amountPaid);
    console.log("Invoice:", invoiceNumber);
    console.log("Invoice URL:", invoiceUrl);
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
      console.error("[Stripe Webhook] Failed to send registration confirmation email:", result.error);
    } else {
      console.log("[Stripe Webhook] Registration confirmation email sent successfully");
    }
  } catch (error) {
    console.error("[Stripe Webhook] Failed to send registration confirmation email:", error);
    // Don't throw - email failure shouldn't break the confirmation
  }
}
