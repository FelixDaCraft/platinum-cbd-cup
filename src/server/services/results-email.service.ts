/**
 * Results Email Service - Story 8.6, 8.7
 * Handles sending synthesis PDFs to producers via email with tracking
 */

import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { env } from "~/env";
import { generateProducerSynthesisPdf } from "./results-pdf.service";
import { formatScoreForScale } from "~/lib/validations/labels";
import type { RatingScale } from "~/server/db/schema/cups";
import { getPortalBaseUrl } from "./app-url";
import {
  EMAIL_SEND_CONCURRENCY,
  escapeHtml,
  mapWithConcurrency,
  renderButton,
  renderCallout,
  renderEmailLayout,
  renderGreeting,
  renderParagraph,
  renderQuote,
  sendEmail,
} from "./email";
import { hasAnyResult, scoreFor } from "~/server/db/panel-columns";
import {
  getProducerCupRegistrationIds,
  getProductsOfRegistrations,
} from "./producer-orders";

/** Nom de l'organisateur : mono-tenant, c'est toujours le concours lui-même. */
const ORGANIZER_NAME = "Platinum CBD Cup";

/**
 * Update email send status for a registration - Story 8.7
 *
 * Au mieux : ce suivi sert à cibler les relances, il n'est pas le résultat de
 * l'envoi. Une écriture qui échoue ne doit surtout pas ressortir en exception,
 * car `sendResultsEmail` est appelée en lot par `sendBulkResultsEmails` : un
 * rejet y interromprait les soixante-sept envois suivants et l'organisateur
 * n'apprendrait même pas lesquels sont déjà partis.
 */
async function updateEmailStatus(
  registrationIds: string[],
  success: boolean,
  error?: string
): Promise<boolean> {
  const registrationId = registrationIds.join(", ");
  try {
    await db
      .update(schema.registrations)
      .set({
        synthesisEmailSentAt: success ? new Date() : null,
        synthesisEmailError: success ? null : error,
        synthesisEmailAttempts: sql`COALESCE(${schema.registrations.synthesisEmailAttempts}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(inArray(schema.registrations.id, registrationIds));
    return true;
  } catch (trackingError) {
    console.error(
      `[Results Email] Suivi d'envoi non enregistré (registration ${registrationId}):`,
      trackingError instanceof Error ? trackingError.message : trackingError
    );
    return false;
  }
}

export interface SendResultsEmailParams {
  registrationId: string;
  customMessage?: string;
}

export interface SendResultsEmailResult {
  success: boolean;
  error?: string;
  emailId?: string;
  /**
   * Vrai quand l'email est bien parti mais que son enregistrement a échoué.
   * L'inscription paraîtra « non envoyée » au tableau de bord et une relance
   * enverrait le PDF une seconde fois : il faut que l'organisateur le sache.
   */
  trackingFailed?: boolean;
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

    // Un e-mail par producteur : ses produits de toutes ses commandes sur la
    // cup (première inscription et commandes complémentaires).
    const orderIds = await getProducerCupRegistrationIds(db, registrationId);
    const allProducts =
      orderIds.length > 1
        ? await getProductsOfRegistrations(db, orderIds)
        : registration.products;

    // Check if there are products with results
    const productsWithResults = allProducts.filter(hasAnyResult);

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
    // Un score par panel : « - » quand le produit n'a pas été noté par ce jury.
    const formatPanelScore = (score: number | null) =>
      score !== null ? formatScoreForScale(score, cup.ratingScale as RatingScale) : "-";
    const productSummary = productsWithResults.map((p) => ({
      name: p.name,
      category: p.category?.name ?? "Sans catégorie",
      scorePro: formatPanelScore(scoreFor(p, "pro")),
      scorePublic: formatPanelScore(scoreFor(p, "public")),
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
    const result = await sendEmail({
      scope: "Results Email",
      ref: `registration ${registrationId}`,
      to: user.email,
      subject: `Vos resultats - ${cup.name}`,
      html: buildResultsEmailHtml({
        producerName: producer.companyName ?? user.name ?? "Producteur",
        cupName: cup.name,
        organizerName: ORGANIZER_NAME,
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

    if (!result.success) {
      // Story 8.7 : l'échec est tracé sur l'inscription pour permettre une relance ciblée.
      await updateEmailStatus(orderIds, false, result.error);
      return { success: false, error: result.error };
    }

    // Update status as sent - Story 8.7 — sur toutes les commandes couvertes.
    const tracked = await updateEmailStatus(orderIds, true);

    return {
      success: true,
      emailId: result.id ?? (result.devFallback ? "dev-mode" : undefined),
      ...(tracked ? {} : { trackingFailed: true }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Results Email] Error:", errorMessage);
    // Update status with error - Story 8.7
    await updateEmailStatus([registrationId], false, errorMessage);
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
  /** Envois partis mais non enregistrés : une relance les doublerait. */
  trackingFailed: number;
  results: Array<{
    registrationId: string;
    producerName: string;
    success: boolean;
    error?: string;
    trackingFailed?: boolean;
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
    orderBy: (reg, { asc }) => [asc(reg.createdAt)],
  });

  // Un envoi par producteur : ses commandes complémentaires sont jointes à
  // sa première inscription (voir sendResultsEmail), qui porte l'envoi.
  const ordersByProducer = new Map<string, typeof registrations>();
  for (const registration of registrations) {
    const orders = ordersByProducer.get(registration.producerId) ?? [];
    orders.push(registration);
    ordersByProducer.set(registration.producerId, orders);
  }
  const producerRegistrations = [...ordersByProducer.values()].map((orders) => ({
    ...orders[0]!,
    products: orders.flatMap((order) => order.products),
  }));

  // Parallélisme borné : chaque envoi regénère un PDF de synthèse (1 à 2 s).
  // En séquence, 68 producteurs dépassaient la coupure du proxy à 100 s et
  // l'organisateur relançait alors que les envois étaient encore en cours.
  const results = await mapWithConcurrency(
    producerRegistrations,
    EMAIL_SEND_CONCURRENCY,
    async (registration) => {
      // Le lot ne doit jamais tomber en entier sur une inscription : un rejet
      // remonterait à `mapWithConcurrency` et annulerait le compte rendu des
      // envois déjà partis, que l'organisateur relancerait en double.
      //
      // La lecture du producteur et des produits est donc DANS le try. Elle
      // était au-dessus, et c'était le seul endroit du lot qui pouvait encore
      // lever : une inscription dont la relation producteur est vide (compte
      // producteur supprimé entre-temps) faisait échouer la déréférence, le
      // rejet remontait à `Promise.all` et `sendBulkResultsEmails` ne rendait
      // plus rien du tout — pas même la liste des soixante envois déjà partis.
      let producerName = "N/A";

      try {
        producerName = registration.producer.companyName ?? "N/A";

        // Skip if no products with results
        const hasResults = registration.products.some(hasAnyResult);
        if (!hasResults) {
          return {
            registrationId: registration.id,
            producerName,
            success: false,
            error: "Aucun produit avec resultats",
            skipped: true,
          };
        }

        const result = await sendResultsEmail({
          registrationId: registration.id,
          customMessage,
        });

        return {
          registrationId: registration.id,
          producerName,
          success: result.success,
          error: result.error,
          trackingFailed: result.trackingFailed,
          skipped: false,
        };
      } catch (error) {
        return {
          registrationId: registration.id,
          producerName,
          success: false,
          error: error instanceof Error ? error.message : "Erreur inattendue",
          skipped: false,
        };
      }
    }
  );

  const skipped = results.filter((r) => r.skipped).length;
  const success = results.filter((r) => r.success).length;

  return {
    success,
    failed: results.length - success - skipped,
    skipped,
    trackingFailed: results.filter((r) => r.trackingFailed).length,
    results: results.map(({ skipped: _skipped, ...rest }) => rest),
  };
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
    scorePro: string;
    scorePublic: string;
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
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(p.name)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(p.category)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${escapeHtml(p.scorePro)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${escapeHtml(p.scorePublic)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${
          p.label
            ? `<span style="background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${escapeHtml(p.label)}</span>`
            : "-"
        }
      </td>
    </tr>
  `
    )
    .join("");

  return renderEmailLayout({
    title: "Vos resultats sont disponibles !",
    body: `
      ${renderGreeting(producerName)}
      ${renderParagraph(`<strong>${escapeHtml(organizerName)}</strong> a le plaisir de vous communiquer les resultats
        de vos produits pour la competition <strong>${escapeHtml(cupName)}</strong>.`)}
      ${customMessage ? renderQuote(customMessage) : ""}
      ${renderCallout({
        content: `<strong>Felicitations !</strong>
          <br />
          Retrouvez en piece jointe votre synthese detaillee avec graphiques.`,
        background: "#fef3c7",
        textColor: "#92400e",
      })}

      <div style="margin-bottom: 24px;">
        <p style="color: #374151; margin: 0 0 16px 0; font-size: 14px; font-weight: 600;">
          Resume de vos resultats :
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Produit</th>
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Categorie</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Jury pro</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Jury public</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Label</th>
            </tr>
          </thead>
          <tbody>
            ${productTableHtml}
          </tbody>
        </table>
      </div>

      ${renderButton(producerPortalUrl, "Voir mes resultats detailles")}

      <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin-top: 32px;">
        Le document PDF en piece jointe contient une analyse detaillee de vos resultats,
        incluant des graphiques radar et votre positionnement par rapport a la moyenne de votre categorie.
      </p>`,
  });
}
