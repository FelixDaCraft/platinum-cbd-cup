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

import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { env } from "~/env";

const resend = new Resend(env.RESEND_API_KEY);

/**
 * Return the single-tenant public base URL.
 */
function getPortalBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? env.BETTER_AUTH_URL;
}

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
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: user.email,
      subject: `${product.name} - Statut mis a jour`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #f59e0b; font-size: 32px; margin: 0;">
              <span style="color: #f59e0b;">Cup</span><span style="color: #1f2937;">Metrics</span>
            </h1>
          </div>

          <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">
            Mise a jour du statut de votre produit
          </h2>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Bonjour ${user.name ?? "Producteur"},
          </p>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Le statut de votre produit <strong>${product.name}</strong> inscrit a la competition
            <strong>${cup.name}</strong> a ete mis a jour.
          </p>

          <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
              <div style="text-align: center;">
                <span style="display: inline-block; padding: 8px 16px; border-radius: 9999px; background-color: ${oldStatusInfo.color}20; color: ${oldStatusInfo.color}; font-weight: 500;">
                  ${oldStatusInfo.label}
                </span>
              </div>
              <div style="font-size: 24px; color: #9ca3af;">→</div>
              <div style="text-align: center;">
                <span style="display: inline-block; padding: 8px 16px; border-radius: 9999px; background-color: ${newStatusInfo.color}20; color: ${newStatusInfo.color}; font-weight: 600;">
                  ${newStatusInfo.label}
                </span>
              </div>
            </div>
          </div>

          ${getStatusExplanation(newStatus)}

          <div style="text-align: center; margin-top: 32px;">
            <a href="${portalBaseUrl}/producer/registrations"
               style="display: inline-block; padding: 14px 28px; background-color: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Voir mes inscriptions
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            Vous recevez cet email car vous avez active les notifications pour vos produits.
            <br />
            <a href="${portalBaseUrl}/producer/profile" style="color: #f59e0b;">
              Gerer mes preferences de notification
            </a>
          </p>
        </div>
      `,
    });

    if (result.error) {
      console.error("[Product Notification] Resend error:", result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`[Product Notification] Email sent successfully to ${user.email}`);
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
      return `
        <div style="background-color: #eff6ff; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
          <p style="color: #1e40af; margin: 0; font-size: 14px;">
            <strong>Echantillon recu</strong><br />
            L'organisateur a confirme la reception de votre echantillon. Il sera bientot evalue par les jurys.
          </p>
        </div>
      `;
    case "rating":
      return `
        <div style="background-color: #f5f3ff; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #8b5cf6;">
          <p style="color: #5b21b6; margin: 0; font-size: 14px;">
            <strong>En cours de notation</strong><br />
            Votre produit est actuellement en train d'etre evalue par les jurys. Les resultats seront disponibles une fois la notation terminee.
          </p>
        </div>
      `;
    case "rated":
      return `
        <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #22c55e;">
          <p style="color: #166534; margin: 0; font-size: 14px;">
            <strong>Notation terminee</strong><br />
            La notation de votre produit est terminee. Connectez-vous pour consulter vos resultats detailles.
          </p>
        </div>
      `;
    default:
      return "";
  }
}
