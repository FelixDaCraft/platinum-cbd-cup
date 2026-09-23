/**
 * Results Email Service - Story 8.6, 8.7
 * Handles sending synthesis PDFs to producers via email with tracking
 */

import { Resend } from "resend";
import { eq, and, sql } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { env } from "~/env";
import { generateProducerSynthesisPdf } from "./results-pdf.service";
import { formatScoreForScale } from "~/lib/validations/labels";
import type { RatingScale } from "~/server/db/schema/cups";

const resend = new Resend(env.RESEND_API_KEY);

/**
 * Return the single-tenant public base URL.
 */
function getPortalBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? env.BETTER_AUTH_URL;
}

/**
 * Update email send status for a registration - Story 8.7
 */
async function updateEmailStatus(
  registrationId: string,
  success: boolean,
  error?: string
): Promise<void> {
  await db
    .update(schema.registrations)
    .set({
      synthesisEmailSentAt: success ? new Date() : null,
      synthesisEmailError: success ? null : error,
      synthesisEmailAttempts: sql`COALESCE(${schema.registrations.synthesisEmailAttempts}, 0) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(schema.registrations.id, registrationId));
}

export interface SendResultsEmailParams {
  registrationId: string;
  customMessage?: string;
}

export interface SendResultsEmailResult {
  success: boolean;
  error?: string;
  emailId?: string;
}

/**
 * Send synthesis PDF to a single producer
 */
export async function sendResultsEmail(
  params: SendResultsEmailParams
): Promise<SendResultsEmailResult> {
  const { registrationId, customMessage } = params;

  try {
    // Get registration with producer and cup info
    const registration = await db.query.registrations.findFirst({
      where: eq(schema.registrations.id, registrationId),
      with: {
        producer: {
          with: {
            user: true,
          },
        },
        cup: true,
        products: {
          with: {
            category: true,
            label: true,
          },
        },
      },
    });

    if (!registration) {
      return { success: false, error: "Inscription non trouvee" };
    }

    if (registration.status !== "confirmed") {
      return { success: false, error: "L'inscription n'est pas confirmee" };
    }

    const producer = registration.producer;
    const cup = registration.cup;
    const user = producer.user;

    // Check if there are products with results
    const productsWithResults = registration.products.filter(
      (p) => p.finalScore !== null
    );

    if (productsWithResults.length === 0) {
      return { success: false, error: "Aucun produit avec resultats" };
    }

    // Generate PDF
    let pdfBuffer: Buffer;
    let filename: string;
    try {
      const pdfResult = await generateProducerSynthesisPdf(registrationId);
      pdfBuffer = pdfResult.buffer;
      filename = pdfResult.filename;
    } catch (error) {
      return {
        success: false,
        error: `Erreur generation PDF: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }

    // Build product summary for email - Story 7.X: Display in organizer's scale
    const productSummary = productsWithResults.map((p) => ({
      name: p.name,
      category: p.category?.name ?? "Sans catégorie",
      score: p.finalScore
        ? formatScoreForScale(parseFloat(p.finalScore), cup.ratingScale as RatingScale)
        : "N/A",
      label: p.label?.name ?? null,
    }));

    // Log in dev mode
    if (env.NODE_ENV === "development") {
      console.log("\n" + "=".repeat(60));
      console.log("ENVOI RESULTATS PRODUCTEUR (DEV MODE)");
      console.log("=".repeat(60));
      console.log("To:", user.email);
      console.log("Producer:", producer.companyName ?? user.name);
      console.log("Cup:", cup.name);
      console.log("Products:", productsWithResults.length);
      console.log("PDF:", filename);
      console.log("=".repeat(60) + "\n");
    }

    // Build portal URL for producer
    const portalBaseUrl = getPortalBaseUrl();

    // Send email with PDF attachment
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: user.email,
      subject: `Vos resultats - ${cup.name}`,
      html: buildResultsEmailHtml({
        producerName: producer.companyName ?? user.name ?? "Producteur",
        cupName: cup.name,
        organizerName: "Platinum CBD Cup",
        customMessage,
        productSummary,
        producerPortalUrl: `${portalBaseUrl}/producer/cups/${cup.id}`,
      }),
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    });

    if (result.error) {
      console.error("[Results Email] Resend error:", result.error);
      // Update status with error - Story 8.7
      await updateEmailStatus(registrationId, false, result.error.message);
      if (env.NODE_ENV === "development") {
        console.warn("[Results Email] Email non envoye (dev mode)");
        // Still mark as sent in dev mode for testing
        await updateEmailStatus(registrationId, true);
        return { success: true, emailId: "dev-mode" };
      }
      return { success: false, error: result.error.message };
    }

    // Update status as sent - Story 8.7
    await updateEmailStatus(registrationId, true);

    console.log(`[Results Email] Email sent successfully to ${user.email}`);
    return { success: true, emailId: result.data?.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Results Email] Error:", errorMessage);
    // Update status with error - Story 8.7
    await updateEmailStatus(registrationId, false, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send synthesis PDFs to all producers in a cup
 */
export async function sendBulkResultsEmails(
  cupId: string,
  customMessage?: string
): Promise<{
  success: number;
  failed: number;
  skipped: number;
  results: Array<{
    registrationId: string;
    producerName: string;
    success: boolean;
    error?: string;
  }>;
}> {
  // Get all confirmed registrations for this cup
  const registrations = await db.query.registrations.findMany({
    where: and(
      eq(schema.registrations.cupId, cupId),
      eq(schema.registrations.status, "confirmed")
    ),
    with: {
      producer: {
        with: {
          user: true,
        },
      },
      products: true,
    },
  });

  const results: Array<{
    registrationId: string;
    producerName: string;
    success: boolean;
    error?: string;
  }> = [];
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const registration of registrations) {
    const producerName = registration.producer.companyName ?? "N/A";

    // Skip if no products with results
    const hasResults = registration.products.some((p) => p.finalScore !== null);
    if (!hasResults) {
      results.push({
        registrationId: registration.id,
        producerName,
        success: false,
        error: "Aucun produit avec resultats",
      });
      skipped++;
      continue;
    }

    const result = await sendResultsEmail({
      registrationId: registration.id,
      customMessage,
    });

    results.push({
      registrationId: registration.id,
      producerName,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed, skipped, results };
}

/**
 * Build results email HTML
 */
interface ResultsEmailParams {
  producerName: string;
  cupName: string;
  organizerName: string;
  customMessage?: string;
  productSummary: Array<{
    name: string;
    category: string;
    score: string;
    label: string | null;
  }>;
  producerPortalUrl: string;
}

function buildResultsEmailHtml(params: ResultsEmailParams): string {
  const {
    producerName,
    cupName,
    organizerName,
    customMessage,
    productSummary,
    producerPortalUrl,
  } = params;

  // Build product table HTML
  const productTableHtml = productSummary
    .map(
      (p) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${p.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${p.category}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${p.score}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${
          p.label
            ? `<span style="background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${p.label}</span>`
            : "-"
        }
      </td>
    </tr>
  `
    )
    .join("");

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #f59e0b; font-size: 32px; margin: 0;">
          <span style="color: #f59e0b;">Cup</span><span style="color: #1f2937;">Metrics</span>
        </h1>
      </div>

      <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">
        Vos resultats sont disponibles !
      </h2>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Bonjour ${producerName},
      </p>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        <strong>${organizerName}</strong> a le plaisir de vous communiquer les resultats
        de vos produits pour la competition <strong>${cupName}</strong>.
      </p>

      ${
        customMessage
          ? `
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
          <p style="color: #4b5563; margin: 0; font-size: 14px; font-style: italic;">
            "${customMessage}"
          </p>
        </div>
      `
          : ""
      }

      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>Felicitations !</strong>
          <br />
          Retrouvez en piece jointe votre synthese detaillee avec graphiques.
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <p style="color: #374151; margin: 0 0 16px 0; font-size: 14px; font-weight: 600;">
          Resume de vos resultats :
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Produit</th>
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Categorie</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Score</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Label</th>
            </tr>
          </thead>
          <tbody>
            ${productTableHtml}
          </tbody>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${producerPortalUrl}"
           style="display: inline-block; background-color: #f59e0b; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Voir mes resultats detailles
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin-top: 32px;">
        Le document PDF en piece jointe contient une analyse detaillee de vos resultats,
        incluant des graphiques radar et votre positionnement par rapport a la moyenne de votre categorie.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Platinum CBD Cup - Le concours de reference des meilleurs CBD
      </p>
    </div>
  `;
}
