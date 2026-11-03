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

import { localizePath } from "~/i18n/locales";
import { translatorFor } from "~/i18n/translator";
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
  recipientLocale,
  strong,
  renderParagraph,
  sendEmail,
} from "./email";

/** Couleur de chaque statut ; le libellé vient de `emails.productStatus`. */
const productStatusColors: Record<string, string> = {
  pending: "#f59e0b",
  received: "#3b82f6",
  rating: "#8b5cf6",
  rated: "#22c55e",
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

    // Langue mémorisée sur le compte du producteur.
    const locale = recipientLocale(user.locale);
    const t = translatorFor(locale, "emails.productStatus");
    const statusInfo = (status: string) => ({
      label: status in productStatusColors ? t(status) : status,
      color: productStatusColors[status] ?? "#6b7280",
    });
    const oldStatusInfo = statusInfo(oldStatus);
    const newStatusInfo = statusInfo(newStatus);

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
      subject: t("subject", { product: product.name }),
      html: renderEmailLayout({
        locale,
        title: t("title"),
        body: `
      ${renderGreeting(user.name ?? translatorFor(locale, "emails")("defaultProducer"), locale)}
      ${renderParagraph(t("intro", { product: strong(product.name), cup: strong(cup.name) }))}

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

          ${getStatusExplanation(newStatus, t)}

          ${renderButton(`${portalBaseUrl}${localizePath("/producer/registrations", locale)}`, t("button"))}`,
        footerHtml: `${escapeHtml(t("footer"))}
            <br />
            <a href="${portalBaseUrl}${localizePath("/producer/profile", locale)}" style="color: #d4af37;">
              ${escapeHtml(t("preferences"))}
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
function getStatusExplanation(status: string, t: ReturnType<typeof translatorFor>): string {
  switch (status) {
    case "received":
      return renderCallout({
        content: `<strong>${escapeHtml(t("receivedTitle"))}</strong><br />
            ${escapeHtml(t("receivedText"))}`,
        background: "#eff6ff",
        textColor: "#1e40af",
        borderColor: "#3b82f6",
      });
    case "rating":
      return renderCallout({
        content: `<strong>${escapeHtml(t("ratingTitle"))}</strong><br />
            ${escapeHtml(t("ratingText"))}`,
        background: "#f5f3ff",
        textColor: "#5b21b6",
        borderColor: "#8b5cf6",
      });
    case "rated":
      return renderCallout({
        content: `<strong>${escapeHtml(t("ratedTitle"))}</strong><br />
            ${escapeHtml(t("ratedText"))}`,
        background: "#f0fdf4",
        textColor: "#166534",
        borderColor: "#22c55e",
      });
    default:
      return "";
  }
}
