/**
 * Jury Invitation Service
 * Handles sending and managing jury invitations
 */

import { Resend } from "resend";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { env } from "~/env";

const resend = new Resend(env.RESEND_API_KEY);

// Invitation expires after 14 days
const INVITATION_EXPIRY_DAYS = 14;

/**
 * Return the single-tenant public base URL.
 * Uses NEXT_PUBLIC_APP_URL when set, falling back to BETTER_AUTH_URL.
 */
function getPortalBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? env.BETTER_AUTH_URL;
}

interface SendInvitationParams {
  cupId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  customMessage?: string;
  invitedByUserId: string;
}

interface SendInvitationResult {
  success: boolean;
  invitationId?: string;
  error?: string;
  alreadyInvited?: boolean;
}

/**
 * Send a jury invitation email
 */
export async function sendJuryInvitation(
  params: SendInvitationParams
): Promise<SendInvitationResult> {
  const { cupId, email, firstName, lastName, customMessage } = params;

  try {
    // Get cup info
    const cup = await db.query.cups.findFirst({
      where: eq(schema.cups.id, cupId),
    });

    if (!cup) {
      return { success: false, error: "Cup not found" };
    }

    // Single-tenant: organizer name is hardcoded to the Platinum CBD Cup org.
    const organizerName = "Platinum CBD Cup";

    // Check if already invited
    const existingInvitation = await db.query.juryInvitations.findFirst({
      where: and(
        eq(schema.juryInvitations.cupId, cupId),
        eq(schema.juryInvitations.email, email.toLowerCase())
      ),
    });

    if (existingInvitation) {
      // If already pending, we can resend
      if (existingInvitation.status === "pending") {
        // Update and resend
        await resendInvitation(existingInvitation.id);
        return { success: true, invitationId: existingInvitation.id, alreadyInvited: true };
      }
      // If accepted, declined, or expired - return error
      if (existingInvitation.status === "accepted") {
        return { success: false, error: "Ce jury a deja accepte l'invitation", alreadyInvited: true };
      }
      if (existingInvitation.status === "declined") {
        return { success: false, error: "Ce jury a refuse l'invitation precedente", alreadyInvited: true };
      }
    }

    // Check if user already exists in the system
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    });

    // Generate unique token
    const token = nanoid(32);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    // Create invitation record
    const invitationId = nanoid();
    await db.insert(schema.juryInvitations).values({
      id: invitationId,
      cupId,
      email: email.toLowerCase(),
      firstName,
      lastName,
      customMessage,
      token,
      userId: existingUser?.id,
      expiresAt,
      sentAt: new Date(),
    });

    // Build invitation URL
    const portalBaseUrl = getPortalBaseUrl();
    const invitationUrl = `${portalBaseUrl}/jury-invite/${token}`;

    // Format name for email
    const juryName = firstName
      ? `${firstName}${lastName ? ` ${lastName}` : ""}`
      : "Jury";

    // Log in dev mode
    if (env.NODE_ENV === "development") {
      console.log("\n" + "=".repeat(60));
      console.log("INVITATION JURY (DEV MODE)");
      console.log("=".repeat(60));
      console.log("To:", email);
      console.log("Cup:", cup.name);
      console.log("URL:", invitationUrl);
      console.log("Token:", token);
      console.log("Expires:", expiresAt.toISOString());
      console.log("=".repeat(60) + "\n");
    }

    // Send invitation email
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: email,
      subject: `Invitation jury - ${cup.name}`,
      html: buildInvitationEmailHtml({
        juryName,
        cupName: cup.name,
        organizerName,
        customMessage,
        invitationUrl,
        expiresAt,
      }),
    });

    if (result.error) {
      console.error("[Jury Invitation] Resend error:", result.error);
      // In dev mode, don't fail - the URL is in the console
      if (env.NODE_ENV === "development") {
        console.warn("[Jury Invitation] Email non envoye, mais URL disponible ci-dessus");
        return { success: true, invitationId };
      }
      return { success: false, error: result.error.message };
    }

    console.log(`[Jury Invitation] Email sent successfully to ${email}`);
    return { success: true, invitationId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Jury Invitation] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Resend an existing invitation
 */
export async function resendInvitation(invitationId: string): Promise<SendInvitationResult> {
  try {
    const invitation = await db.query.juryInvitations.findFirst({
      where: eq(schema.juryInvitations.id, invitationId),
      with: {
        cup: true,
      },
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.status !== "pending") {
      return { success: false, error: "Cette invitation n'est plus en attente" };
    }

    const cup = invitation.cup;

    // Single-tenant: organizer name is hardcoded.
    const organizerName = "Platinum CBD Cup";

    // Extend expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    // Update invitation
    const reminderCount = parseInt(invitation.reminderCount ?? "0", 10) + 1;
    await db
      .update(schema.juryInvitations)
      .set({
        sentAt: new Date(),
        lastReminderAt: new Date(),
        reminderCount: reminderCount.toString(),
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.juryInvitations.id, invitationId));

    // Build invitation URL
    const portalBaseUrl = getPortalBaseUrl();
    const invitationUrl = `${portalBaseUrl}/jury-invite/${invitation.token}`;

    // Format name
    const juryName = invitation.firstName
      ? `${invitation.firstName}${invitation.lastName ? ` ${invitation.lastName}` : ""}`
      : "Jury";

    // Log in dev mode
    if (env.NODE_ENV === "development") {
      console.log("\n" + "=".repeat(60));
      console.log("RELANCE INVITATION JURY (DEV MODE)");
      console.log("=".repeat(60));
      console.log("To:", invitation.email);
      console.log("Cup:", cup.name);
      console.log("URL:", invitationUrl);
      console.log("Reminder #:", reminderCount);
      console.log("=".repeat(60) + "\n");
    }

    // Send reminder email
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: invitation.email,
      subject: `Rappel: Invitation jury - ${cup.name}`,
      html: buildReminderEmailHtml({
        juryName,
        cupName: cup.name,
        organizerName,
        invitationUrl,
        expiresAt,
        isReminder: true,
      }),
    });

    if (result.error) {
      console.error("[Jury Invitation] Resend error:", result.error);
      if (env.NODE_ENV === "development") {
        console.warn("[Jury Invitation] Email non envoye, mais URL disponible ci-dessus");
        return { success: true, invitationId };
      }
      return { success: false, error: result.error.message };
    }

    console.log(`[Jury Invitation] Reminder email sent successfully to ${invitation.email}`);
    return { success: true, invitationId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Jury Invitation] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send invitations to multiple juries
 */
export async function sendBulkInvitations(
  cupId: string,
  juries: Array<{ email: string; firstName?: string; lastName?: string }>,
  invitedByUserId: string,
  customMessage?: string
): Promise<{
  success: number;
  failed: number;
  alreadyInvited: number;
  results: Array<{ email: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ email: string; success: boolean; error?: string }> = [];
  let success = 0;
  let failed = 0;
  let alreadyInvited = 0;

  for (const jury of juries) {
    const result = await sendJuryInvitation({
      cupId,
      email: jury.email,
      firstName: jury.firstName,
      lastName: jury.lastName,
      customMessage,
      invitedByUserId,
    });

    results.push({
      email: jury.email,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      if (result.alreadyInvited) {
        alreadyInvited++;
      } else {
        success++;
      }
    } else {
      if (result.alreadyInvited) {
        alreadyInvited++;
      } else {
        failed++;
      }
    }
  }

  return { success, failed, alreadyInvited, results };
}

// Email HTML builders

interface InvitationEmailParams {
  juryName: string;
  cupName: string;
  organizerName: string;
  customMessage?: string;
  invitationUrl: string;
  expiresAt: Date;
}

function buildInvitationEmailHtml(params: InvitationEmailParams): string {
  const { juryName, cupName, organizerName, customMessage, invitationUrl, expiresAt } = params;
  const formattedExpiry = expiresAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #f59e0b; font-size: 32px; margin: 0;">
          <span style="color: #f59e0b;">Cup</span><span style="color: #1f2937;">Metrics</span>
        </h1>
      </div>

      <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">
        Invitation jury
      </h2>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Bonjour ${juryName},
      </p>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        <strong>${organizerName}</strong> vous invite a participer en tant que jury
        a la competition <strong>${cupName}</strong>.
      </p>

      ${customMessage ? `
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
          <p style="color: #4b5563; margin: 0; font-size: 14px; font-style: italic;">
            "${customMessage}"
          </p>
        </div>
      ` : ""}

      <div style="text-align: center; margin: 24px 0;">
        <a href="${invitationUrl}"
           style="display: inline-block; background-color: #f59e0b; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Accepter l'invitation
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-bottom: 24px;">
        Ou copiez ce lien : <a href="${invitationUrl}" style="color: #f59e0b;">${invitationUrl}</a>
      </p>

      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>En tant que jury, vous pourrez :</strong>
        </p>
        <ul style="color: #92400e; margin: 8px 0 0 0; padding-left: 20px; font-size: 14px;">
          <li>Noter les produits selon des criteres definis</li>
          <li>Ajouter des commentaires detailles</li>
          <li>Contribuer au classement final</li>
        </ul>
      </div>

      <p style="color: #9ca3af; font-size: 14px; line-height: 1.5;">
        Cette invitation expire le <strong>${formattedExpiry}</strong>.
        Si vous ne souhaitez pas participer, ignorez simplement cet email.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        CupMetrics - Plateforme de gestion de competitions de degustation
      </p>
    </div>
  `;
}

interface ReminderEmailParams {
  juryName: string;
  cupName: string;
  organizerName: string;
  invitationUrl: string;
  expiresAt: Date;
  isReminder: boolean;
}

function buildReminderEmailHtml(params: ReminderEmailParams): string {
  const { juryName, cupName, organizerName, invitationUrl, expiresAt } = params;
  const formattedExpiry = expiresAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #f59e0b; font-size: 32px; margin: 0;">
          <span style="color: #f59e0b;">Cup</span><span style="color: #1f2937;">Metrics</span>
        </h1>
      </div>

      <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">
        Rappel : Invitation jury en attente
      </h2>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Bonjour ${juryName},
      </p>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Vous avez ete invite par <strong>${organizerName}</strong> a participer
        en tant que jury a la competition <strong>${cupName}</strong>.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${invitationUrl}"
           style="display: inline-block; background-color: #f59e0b; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Accepter l'invitation
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-bottom: 24px;">
        Ou copiez ce lien : <a href="${invitationUrl}" style="color: #f59e0b;">${invitationUrl}</a>
      </p>

      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>Votre reponse est attendue !</strong>
          <br />
          L'organisateur compte sur votre participation.
        </p>
      </div>

      <p style="color: #9ca3af; font-size: 14px; line-height: 1.5;">
        Cette invitation expire le <strong>${formattedExpiry}</strong>.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        CupMetrics - Plateforme de gestion de competitions de degustation
      </p>
    </div>
  `;
}

/**
 * Send a rating reminder to an active jury
 */
export interface SendRatingReminderParams {
  cupJuryId: string;
  completionStats?: {
    totalProductsToRate: number;
    productsRated: number;
    completionRate: number;
  };
}

export interface SendRatingReminderResult {
  success: boolean;
  error?: string;
}

export async function sendRatingReminder(
  params: SendRatingReminderParams
): Promise<SendRatingReminderResult> {
  const { cupJuryId, completionStats } = params;

  try {
    // Get jury with user and cup info
    const jury = await db.query.cupJuries.findFirst({
      where: eq(schema.cupJuries.id, cupJuryId),
      with: {
        user: true,
        cup: true,
      },
    });

    if (!jury) {
      return { success: false, error: "Jury non trouve" };
    }

    if (!jury.isActive) {
      return { success: false, error: "Ce jury n'est plus actif" };
    }

    if (!jury.notifyOnReminder) {
      return { success: false, error: "Ce jury a desactive les notifications de rappel" };
    }

    const cup = jury.cup;
    const user = jury.user;

    // Update reminder tracking
    const reminderCount = parseInt(jury.reminderCount ?? "0", 10) + 1;
    await db
      .update(schema.cupJuries)
      .set({
        lastReminderAt: new Date(),
        reminderCount: reminderCount.toString(),
        updatedAt: new Date(),
      })
      .where(eq(schema.cupJuries.id, cupJuryId));

    // Build rating URL
    const portalBaseUrl = getPortalBaseUrl();
    const ratingUrl = `${portalBaseUrl}/jury/cups/${cup.id}`;

    // Log in dev mode
    if (env.NODE_ENV === "development") {
      console.log("\n" + "=".repeat(60));
      console.log("RELANCE NOTATION JURY (DEV MODE)");
      console.log("=".repeat(60));
      console.log("To:", user.email);
      console.log("Jury:", user.name ?? user.email);
      console.log("Cup:", cup.name);
      console.log("URL:", ratingUrl);
      console.log("Reminder #:", reminderCount);
      if (completionStats) {
        console.log("Progress:", `${completionStats.productsRated}/${completionStats.totalProductsToRate} (${completionStats.completionRate}%)`);
      }
      console.log("=".repeat(60) + "\n");
    }

    // Send rating reminder email
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: user.email,
      subject: `Rappel: Notation en attente - ${cup.name}`,
      html: buildRatingReminderEmailHtml({
        juryName: user.name ?? "Jury",
        cupName: cup.name,
        organizerName: "Platinum CBD Cup",
        ratingUrl,
        completionStats,
      }),
    });

    if (result.error) {
      console.error("[Jury Rating Reminder] Resend error:", result.error);
      if (env.NODE_ENV === "development") {
        console.warn("[Jury Rating Reminder] Email non envoye, mais URL disponible ci-dessus");
        return { success: true };
      }
      return { success: false, error: result.error.message };
    }

    console.log(`[Jury Rating Reminder] Email sent successfully to ${user.email}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Jury Rating Reminder] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send rating reminders to multiple juries
 */
export async function sendBulkRatingReminders(
  juryIds: string[],
  completionStatsMap?: Map<string, { totalProductsToRate: number; productsRated: number; completionRate: number }>
): Promise<{
  success: number;
  failed: number;
  skipped: number;
  results: Array<{ juryId: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ juryId: string; success: boolean; error?: string }> = [];
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const juryId of juryIds) {
    const completionStats = completionStatsMap?.get(juryId);
    const result = await sendRatingReminder({
      cupJuryId: juryId,
      completionStats,
    });

    results.push({
      juryId,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      success++;
    } else if (result.error?.includes("desactive les notifications")) {
      skipped++;
    } else {
      failed++;
    }
  }

  return { success, failed, skipped, results };
}

/**
 * Build rating reminder email HTML
 */
interface RatingReminderEmailParams {
  juryName: string;
  cupName: string;
  organizerName: string;
  ratingUrl: string;
  completionStats?: {
    totalProductsToRate: number;
    productsRated: number;
    completionRate: number;
  };
}

function buildRatingReminderEmailHtml(params: RatingReminderEmailParams): string {
  const { juryName, cupName, organizerName, ratingUrl, completionStats } = params;

  const progressHtml = completionStats
    ? `
      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">
          Votre progression :
        </p>
        <div style="background-color: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
          <div style="background-color: #f59e0b; height: 100%; width: ${completionStats.completionRate}%;"></div>
        </div>
        <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 12px;">
          ${completionStats.productsRated} / ${completionStats.totalProductsToRate} produits notes (${completionStats.completionRate}%)
        </p>
      </div>
    `
    : "";

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #f59e0b; font-size: 32px; margin: 0;">
          <span style="color: #f59e0b;">Cup</span><span style="color: #1f2937;">Metrics</span>
        </h1>
      </div>

      <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">
        Rappel : Notation en attente
      </h2>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Bonjour ${juryName},
      </p>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        <strong>${organizerName}</strong> vous rappelle que vous avez des produits
        a noter pour la competition <strong>${cupName}</strong>.
      </p>

      ${progressHtml}

      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>Vos notes sont importantes !</strong>
          <br />
          Elles contribuent au classement final de la competition.
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${ratingUrl}"
           style="display: inline-block; background-color: #f59e0b; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Continuer la notation
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        CupMetrics - Plateforme de gestion de competitions de degustation
        <br />
        <a href="#" style="color: #9ca3af;">Gerer mes preferences de notification</a>
      </p>
    </div>
  `;
}

/**
 * Send rating sheet email to a jury
 * Contains the list of products to rate and link to rating interface
 */
export interface SendRatingSheetParams {
  cupJuryId: string;
  products: Array<{
    categoryName: string;
    productCode: string;
  }>;
}

export interface SendRatingSheetResult {
  success: boolean;
  error?: string;
}

export async function sendRatingSheet(
  params: SendRatingSheetParams
): Promise<SendRatingSheetResult> {
  const { cupJuryId, products } = params;

  try {
    // Get jury with user and cup info
    const jury = await db.query.cupJuries.findFirst({
      where: eq(schema.cupJuries.id, cupJuryId),
      with: {
        user: true,
        cup: true,
        categoryAssignments: {
          with: {
            category: true,
          },
        },
      },
    });

    if (!jury) {
      return { success: false, error: "Jury non trouve" };
    }

    if (!jury.isActive) {
      return { success: false, error: "Ce jury n'est plus actif" };
    }

    const cup = jury.cup;
    const user = jury.user;

    // Update rating sheet sent tracking
    await db
      .update(schema.cupJuries)
      .set({
        ratingSheetSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.cupJuries.id, cupJuryId));

    // Build rating URL
    const portalBaseUrl = getPortalBaseUrl();
    const ratingUrl = `${portalBaseUrl}/jury/cups/${cup.id}`;

    // Group products by category for email
    const productsByCategory = new Map<string, string[]>();
    for (const product of products) {
      const existing = productsByCategory.get(product.categoryName) ?? [];
      existing.push(product.productCode);
      productsByCategory.set(product.categoryName, existing);
    }

    // Log in dev mode
    if (env.NODE_ENV === "development") {
      console.log("\n" + "=".repeat(60));
      console.log("FICHE DE NOTATION JURY (DEV MODE)");
      console.log("=".repeat(60));
      console.log("To:", user.email);
      console.log("Jury:", user.name ?? user.email);
      console.log("Cup:", cup.name);
      console.log("URL:", ratingUrl);
      console.log("Categories:", jury.categoryAssignments.map((a) => a.category.name).join(", "));
      console.log("Products:", products.length);
      console.log("=".repeat(60) + "\n");
    }

    // Send rating sheet email
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: user.email,
      subject: `Fiche de notation - ${cup.name}`,
      html: buildRatingSheetEmailHtml({
        juryName: user.name ?? "Jury",
        cupName: cup.name,
        organizerName: "Platinum CBD Cup",
        ratingUrl,
        categories: jury.categoryAssignments.map((a) => a.category.name),
        productsByCategory,
        totalProducts: products.length,
      }),
    });

    if (result.error) {
      console.error("[Jury Rating Sheet] Resend error:", result.error);
      if (env.NODE_ENV === "development") {
        console.warn("[Jury Rating Sheet] Email non envoye, mais URL disponible ci-dessus");
        return { success: true };
      }
      return { success: false, error: result.error.message };
    }

    console.log(`[Jury Rating Sheet] Email sent successfully to ${user.email}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Jury Rating Sheet] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send rating sheets to multiple juries
 */
export async function sendBulkRatingSheets(
  juriesData: Array<{
    cupJuryId: string;
    products: Array<{ categoryName: string; productCode: string }>;
  }>
): Promise<{
  success: number;
  failed: number;
  results: Array<{ juryId: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ juryId: string; success: boolean; error?: string }> = [];
  let success = 0;
  let failed = 0;

  for (const juryData of juriesData) {
    const result = await sendRatingSheet(juryData);

    results.push({
      juryId: juryData.cupJuryId,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed, results };
}

/**
 * Build rating sheet email HTML
 */
interface RatingSheetEmailParams {
  juryName: string;
  cupName: string;
  organizerName: string;
  ratingUrl: string;
  categories: string[];
  productsByCategory: Map<string, string[]>;
  totalProducts: number;
}

function buildRatingSheetEmailHtml(params: RatingSheetEmailParams): string {
  const { juryName, cupName, organizerName, ratingUrl, categories, productsByCategory, totalProducts } = params;

  // Build category list HTML
  let categoryListHtml = "";
  for (const [categoryName, productCodes] of productsByCategory) {
    categoryListHtml += `
      <div style="margin-bottom: 16px;">
        <p style="color: #374151; margin: 0 0 8px 0; font-weight: 600;">
          ${categoryName} (${productCodes.length} produit${productCodes.length !== 1 ? "s" : ""})
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${productCodes.map((code) => `
            <span style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #374151;">
              ${code}
            </span>
          `).join("")}
        </div>
      </div>
    `;
  }

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #f59e0b; font-size: 32px; margin: 0;">
          <span style="color: #f59e0b;">Cup</span><span style="color: #1f2937;">Metrics</span>
        </h1>
      </div>

      <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">
        Fiche de notation
      </h2>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Bonjour ${juryName},
      </p>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Voici votre fiche de notation pour la competition <strong>${cupName}</strong>
        organisee par <strong>${organizerName}</strong>.
      </p>

      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">
          Vos categories assignees :
        </p>
        <ul style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px;">
          ${categories.map((cat) => `<li>${cat}</li>`).join("")}
        </ul>
      </div>

      <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">
          Produits a noter (${totalProducts} au total) :
        </p>
        ${categoryListHtml}
      </div>

      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>Instructions :</strong>
          <br />
          Cliquez sur le bouton ci-dessous pour acceder a l'interface de notation.
          Vous pourrez noter chaque produit selon les criteres definis.
        </p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${ratingUrl}"
           style="display: inline-block; background-color: #f59e0b; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Commencer la notation
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        CupMetrics - Plateforme de gestion de competitions de degustation
      </p>
    </div>
  `;
}

/**
 * Send a welcome email to a newly registered jury member
 * This is sent when a jury registers directly from an invitation link
 */
export interface SendJuryWelcomeEmailParams {
  userId: string;
  cupId: string;
}

export interface SendJuryWelcomeEmailResult {
  success: boolean;
  error?: string;
}

export async function sendJuryWelcomeEmail(
  params: SendJuryWelcomeEmailParams
): Promise<SendJuryWelcomeEmailResult> {
  const { userId, cupId } = params;

  try {
    // Get user info
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      return { success: false, error: "Utilisateur non trouve" };
    }

    // Get cup info
    const cup = await db.query.cups.findFirst({
      where: eq(schema.cups.id, cupId),
    });

    if (!cup) {
      return { success: false, error: "Cup non trouvee" };
    }

    // Build dashboard URL
    const portalBaseUrl = getPortalBaseUrl();
    const dashboardUrl = `${portalBaseUrl}/jury/dashboard`;
    const loginUrl = `${portalBaseUrl}/login`;

    // Log in dev mode
    if (env.NODE_ENV === "development") {
      console.log("\n" + "=".repeat(60));
      console.log("EMAIL BIENVENUE JURY (DEV MODE)");
      console.log("=".repeat(60));
      console.log("To:", user.email);
      console.log("Jury:", user.name);
      console.log("Cup:", cup.name);
      console.log("Dashboard URL:", dashboardUrl);
      console.log("Login URL:", loginUrl);
      console.log("=".repeat(60) + "\n");
    }

    // Send welcome email
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: user.email,
      subject: `Bienvenue dans le jury - ${cup.name}`,
      html: buildJuryWelcomeEmailHtml({
        juryName: user.name,
        cupName: cup.name,
        organizerName: "Platinum CBD Cup",
        dashboardUrl,
        loginUrl,
      }),
    });

    if (result.error) {
      console.error("[Jury Welcome Email] Resend error:", result.error);
      if (env.NODE_ENV === "development") {
        console.warn("[Jury Welcome Email] Email non envoye, mais URLs disponibles ci-dessus");
        return { success: true };
      }
      return { success: false, error: result.error.message };
    }

    console.log(`[Jury Welcome Email] Email sent successfully to ${user.email}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Jury Welcome Email] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Build jury welcome email HTML
 */
interface JuryWelcomeEmailParams {
  juryName: string;
  cupName: string;
  organizerName: string;
  dashboardUrl: string;
  loginUrl: string;
}

function buildJuryWelcomeEmailHtml(params: JuryWelcomeEmailParams): string {
  const { juryName, cupName, organizerName, dashboardUrl, loginUrl } = params;

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #f59e0b; font-size: 32px; margin: 0;">
          <span style="color: #f59e0b;">Cup</span><span style="color: #1f2937;">Metrics</span>
        </h1>
      </div>

      <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">
        Bienvenue dans le jury !
      </h2>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Bonjour ${juryName},
      </p>

      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        Votre compte a ete cree avec succes ! Vous faites maintenant partie du jury
        de la competition <strong>${cupName}</strong> organisee par <strong>${organizerName}</strong>.
      </p>

      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>Prochaines etapes :</strong>
        </p>
        <ul style="color: #92400e; margin: 8px 0 0 0; padding-left: 20px; font-size: 14px;">
          <li>Connectez-vous a votre espace jury</li>
          <li>Attendez l'ouverture de la phase de notation</li>
          <li>Notez les produits selon les criteres definis</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}"
           style="display: inline-block; background-color: #f59e0b; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Acceder a mon espace jury
        </a>
      </div>

      <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin-top: 32px;">
        Conservez cet email, il contient le lien vers votre espace jury.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        CupMetrics - Plateforme de gestion de competitions de degustation
      </p>
    </div>
  `;
}
