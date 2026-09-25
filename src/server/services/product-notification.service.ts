/**
 * Product Notification Service
 * Handles notifications when product status changes
 *
 * INTEGRATION NOTE:
 * This service is ready to be called from endpoints that change product status.
 * Future stories (sample reception, jury rating) should import and call:
 *   import { notifyProductStatusChange } from "~/server/services/product-notification.service";
 *   await notifyProductStatusChange(productId, oldStatus, newStatus);
 */

import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { env } from "~/env";
import { getPortalBaseUrl } from "./app-url";
import {
  escapeHtml,
  renderButton,
  renderCallout,
  renderEmailLayout,
  renderGreeting,
  renderParagraph,
  sendEmail,
} from "./email";

/**
 * Product status labels for display in emails
 * NOTE: Using ASCII-only characters (no accents) for maximum email client compatibility
 * "Recu" instead of "Reçu", "Note" instead of "Noté", etc.
 */
const productStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "#f59e0b" },
  received: { label: "Recu", color: "#3b82f6" },
  rating: { label: "En notation", color: "#8b5cf6" },
  rated: { label: "Note", color: "#22c55e" },
};

/**
 * Notify producer when their product status changes
 * Checks notification preferences before sending
 */
export async function notifyProductStatusChange(
  productId: string,
  oldStatus: string,
  newStatus: string
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    // Load product with registration, producer, user, and cup info
    const product = await db.query.products.findFirst({
      where: eq(schema.products.id, productId),
      with: {
        registration: {
          with: {
            producer: {
              with: {
                user: true,
              },
            },
            cup: true,
          },
        },
      },
    });

    if (!product) {
      return { success: false, error: `Product not found: ${productId}` };
    }

    const producer = product.registration.producer;
    const user = producer.user;
    const cup = product.registration.cup;

    // Get portal URL for producer links
    const portalBaseUrl = getPortalBaseUrl();

    // Check notification preference
    if (!producer.notifyOnProductStatusChange) {
      console.log(`[Product Notification] Skipped - producer ${producer.id} has notifications disabled`);
      return { success: true, skipped: true };
    }

    // Get status labels
    const oldStatusInfo = productStatusLabels[oldStatus] ?? { label: oldStatus, color: "#6b7280" };
    const newStatusInfo = productStatusLabels[newStatus] ?? { label: newStatus, color: "#6b7280" };

    // Log in dev mode
    if (env.NODE_ENV === "development") {
      console.log("\n" + "=".repeat(60));
      console.log("📦 EMAIL CHANGEMENT STATUT PRODUIT (DEV MODE)");
      console.log("=".repeat(60));
      console.log("To:", user.email);
      console.log("Product:", product.name);
      console.log("Status:", `${oldStatusInfo.label} -> ${newStatusInfo.label}`);
      console.log("Cup:", cup.name);
      console.log("=".repeat(60) + "\n");
    }

    // Send email
    const result = await sendEmail({
      scope: "Product Notification",
      ref: `product ${productId}`,
      to: user.email,
      subject: `${product.name} - Statut mis a jour`,
      html: renderEmailLayout({
        title: "Mise a jour du statut de votre produit",
        body: `
      ${renderGreeting(user.name ?? "Producteur")}
      ${renderParagraph(`Le statut de votre produit <strong>${escapeHtml(product.name)}</strong> inscrit a la competition
            <strong>${escapeHtml(cup.name)}</strong> a ete mis a jour.`)}

          <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
              <div style="text-align: center;">
                <span style="display: inline-block; padding: 8px 16px; border-radius: 9999px; background-color: ${oldStatusInfo.color}20; color: ${oldStatusInfo.color}; font-weight: 500;">
                  ${escapeHtml(oldStatusInfo.label)}
                </span>
              </div>
              <div style="font-size: 24px; color: #9ca3af;">&rarr;</div>
              <div style="text-align: center;">
                <span style="display: inline-block; padding: 8px 16px; border-radius: 9999px; background-color: ${newStatusInfo.color}20; color: ${newStatusInfo.color}; font-weight: 600;">
                  ${escapeHtml(newStatusInfo.label)}
                </span>
              </div>
            </div>
          </div>

          ${getStatusExplanation(newStatus)}

          ${renderButton(`${portalBaseUrl}/producer/registrations`, "Voir mes inscriptions")}`,
        footerHtml: `Vous recevez cet email car vous avez active les notifications pour vos produits.
            <br />
            <a href="${portalBaseUrl}/producer/profile" style="color: #d4af37;">
              Gerer mes preferences de notification
            </a>`,
      }),
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Product Notification] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get explanation text for the new status
 */
function getStatusExplanation(status: string): string {
  switch (status) {
    case "received":
      return renderCallout({
        content: `<strong>Echantillon recu</strong><br />
            L'organisateur a confirme la reception de votre echantillon. Il sera bientot evalue par les jurys.`,
        background: "#eff6ff",
        textColor: "#1e40af",
        borderColor: "#3b82f6",
      });
    case "rating":
      return renderCallout({
        content: `<strong>En cours de notation</strong><br />
            Votre produit est actuellement en train d'etre evalue par les jurys. Les resultats seront disponibles une fois la notation terminee.`,
        background: "#f5f3ff",
        textColor: "#5b21b6",
        borderColor: "#8b5cf6",
      });
    case "rated":
      return renderCallout({
        content: `<strong>Notation terminee</strong><br />
            La notation de votre produit est terminee. Connectez-vous pour consulter vos resultats detailles.`,
        background: "#f0fdf4",
        textColor: "#166534",
        borderColor: "#22c55e",
      });
    default:
      return "";
  }
}
