/**
 * Jury Invitation Service
 * Handles sending and managing jury invitations
 */

import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { env } from "~/env";
import { getPortalBaseUrl } from "./app-url";
import {
  EMAIL_SEND_CONCURRENCY,
  escapeHtml,
  mapWithConcurrency,
  renderButton,
  renderEmailLayout,
  renderFallbackLink,
  renderGreeting,
  renderHighlight,
  renderParagraph,
  renderQuote,
  recipientLocale,
  sendEmail,
  strong,
} from "./email";
import { formatDate, localizePath, localizedField, type Locale } from "~/i18n/locales";
import { translatorFor } from "~/i18n/translator";

/** Traducteur des e-mails jury (espace `emails.jury`). */
function juryT(locale: Locale) {
  return translatorFor(locale, "emails.jury");
}

/**
 * Langue d'un e-mail adressé à une adresse : celle du compte qui la porte
 * s'il existe déjà (un producteur invité au jury, un juré d'une édition
 * précédente), sinon le français.
 */
async function localeForEmail(email: string): Promise<Locale> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
      columns: { locale: true },
    });
    return recipientLocale(user?.locale);
  } catch {
    return "fr";
  }
}

// Invitation expires after 14 days
const INVITATION_EXPIRY_DAYS = 14;

/** Nom de l'organisateur : mono-tenant, c'est toujours le concours lui-même. */
const ORGANIZER_NAME = "Platinum CBD Cup";

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
  /** Invitation expirée rouverte : nouveau lien, nouvelle échéance. */
  reinvited?: boolean;
}

/** Échéance d'une invitation envoyée maintenant. */
function invitationExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);
  return expiresAt;
}

/** Nom affiché dans l'email : prénom (et nom) saisis, sinon « Juré ». */
function formatJuryName(
  firstName?: string | null,
  lastName?: string | null,
  locale: Locale = "fr"
): string {
  return firstName
    ? `${firstName}${lastName ? ` ${lastName}` : ""}`
    : translatorFor(locale, "emails")("defaultJuror");
}

/** Envoie l'email d'invitation initial (premier envoi ou invitation rouverte). */
async function sendInitialInvitationEmail(params: {
  invitationId: string;
  email: string;
  token: string;
  cupName: string;
  firstName?: string | null;
  lastName?: string | null;
  customMessage?: string | null;
  expiresAt: Date;
}): Promise<SendInvitationResult> {
  const locale = await localeForEmail(params.email);
  const invitationUrl = `${getPortalBaseUrl()}${localizePath(`/jury-invite/${params.token}`, locale)}`;

  if (env.NODE_ENV === "development") {
    console.log("\n" + "=".repeat(60));
    console.log("INVITATION JURY (DEV MODE)");
    console.log("=".repeat(60));
    console.log("To:", params.email);
    console.log("Cup:", params.cupName);
    console.log("URL:", invitationUrl);
    console.log("Token:", params.token);
    console.log("Expires:", params.expiresAt.toISOString());
    console.log("=".repeat(60) + "\n");
  }

  const result = await sendEmail({
    scope: "Jury Invitation",
    ref: `invitation ${params.invitationId}`,
    to: params.email,
    subject: juryT(locale)("invitationSubject", { cup: params.cupName }),
    html: buildInvitationEmailHtml({
      locale,
      juryName: formatJuryName(params.firstName, params.lastName, locale),
      cupName: params.cupName,
      organizerName: ORGANIZER_NAME,
      customMessage: params.customMessage ?? undefined,
      invitationUrl,
      expiresAt: params.expiresAt,
    }),
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, invitationId: params.invitationId };
}

/**
 * Rouvre une invitation expirée : nouveau jeton (l'ancien lien reste mort),
 * nouvelle échéance, statut « pending », puis renvoi de l'email initial.
 *
 * La ligne est réutilisée plutôt que recréée : l'unicité (cup, email) de
 * `jury_invitations` faisait échouer toute nouvelle invitation à l'adresse.
 */
async function reopenExpiredInvitation(
  invitationId: string,
  overrides: { firstName?: string; lastName?: string; customMessage?: string } = {}
): Promise<SendInvitationResult> {
  const invitation = await db.query.juryInvitations.findFirst({
    where: eq(schema.juryInvitations.id, invitationId),
    with: { cup: true },
  });

  if (!invitation) {
    return { success: false, error: "Invitation non trouvee" };
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, invitation.email.toLowerCase()),
    columns: { id: true },
  });

  const token = nanoid(32);
  const expiresAt = invitationExpiry();
  const now = new Date();
  const firstName = overrides.firstName ?? invitation.firstName;
  const lastName = overrides.lastName ?? invitation.lastName;
  const customMessage = overrides.customMessage ?? invitation.customMessage;

  // Le filtre sur « expired » évite de rouvrir deux fois en parallèle.
  const reopened = await db
    .update(schema.juryInvitations)
    .set({
      token,
      status: "pending",
      expiresAt,
      sentAt: now,
      lastReminderAt: null,
      reminderCount: 0,
      firstName,
      lastName,
      customMessage,
      userId: existingUser?.id ?? invitation.userId,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.juryInvitations.id, invitationId),
        eq(schema.juryInvitations.status, "expired")
      )
    )
    .returning({ id: schema.juryInvitations.id });

  if (reopened.length === 0) {
    return { success: false, error: "Cette invitation n'est plus expiree" };
  }

  const result = await sendInitialInvitationEmail({
    invitationId,
    email: invitation.email,
    token,
    cupName: invitation.cup.name,
    firstName,
    lastName,
    customMessage,
    expiresAt,
  });

  return result.success ? { ...result, reinvited: true } : result;
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
      if (existingInvitation.status === "accepted") {
        return { success: false, error: "Ce jury a deja accepte l'invitation", alreadyInvited: true };
      }
      if (existingInvitation.status === "declined") {
        return { success: false, error: "Ce jury a refuse l'invitation precedente", alreadyInvited: true };
      }
      // Expirée : on rouvre la même ligne (contrainte unique cup + email).
      return await reopenExpiredInvitation(existingInvitation.id, {
        firstName,
        lastName,
        customMessage,
      });
    }

    // Check if user already exists in the system
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    });

    const token = nanoid(32);
    const expiresAt = invitationExpiry();

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

    return await sendInitialInvitationEmail({
      invitationId,
      email,
      token,
      cupName: cup.name,
      firstName,
      lastName,
      customMessage,
      expiresAt,
    });
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

    // Une invitation expirée se relance aussi : elle est rouverte.
    if (invitation.status === "expired") {
      return await reopenExpiredInvitation(invitationId);
    }

    if (invitation.status !== "pending") {
      return { success: false, error: "Cette invitation n'est plus en attente" };
    }

    const cup = invitation.cup;

    // Extend expiry date
    const expiresAt = invitationExpiry();

    // Update invitation
    const reminderCount = (invitation.reminderCount ?? 0) + 1;
    await db
      .update(schema.juryInvitations)
      .set({
        sentAt: new Date(),
        lastReminderAt: new Date(),
        reminderCount,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.juryInvitations.id, invitationId));

    // Build invitation URL
    const portalBaseUrl = getPortalBaseUrl();
    const locale = await localeForEmail(invitation.email);
    const invitationUrl = `${portalBaseUrl}${localizePath(`/jury-invite/${invitation.token}`, locale)}`;

    const juryName = formatJuryName(invitation.firstName, invitation.lastName, locale);

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
    const result = await sendEmail({
      scope: "Jury Invitation Reminder",
      ref: `invitation ${invitationId}`,
      to: invitation.email,
      subject: juryT(locale)("reminderSubject", { cup: cup.name }),
      html: buildReminderEmailHtml({
        locale,
        juryName,
        cupName: cup.name,
        organizerName: ORGANIZER_NAME,
        invitationUrl,
        expiresAt,
      }),
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

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
  locale: Locale;
  juryName: string;
  cupName: string;
  organizerName: string;
  customMessage?: string;
  invitationUrl: string;
  expiresAt: Date;
}

/** Date d'expiration en toutes lettres, telle qu'affichée dans l'email. */
function formatExpiry(expiresAt: Date, locale: Locale): string {
  return formatDate(expiresAt, locale);
}

/**
 * Invitation initiale et relance ne différaient que par le titre et deux
 * paragraphes : un seul gabarit, paramétré par `variant`.
 */
function buildInvitationEmailHtml(
  params: InvitationEmailParams,
  variant: "initial" | "reminder" = "initial"
): string {
  const { invitationUrl, expiresAt, customMessage, locale } = params;
  const t = juryT(locale);
  const cupName = strong(params.cupName);
  const organizerName = strong(params.organizerName);
  const isReminder = variant === "reminder";

  const intro = isReminder
    ? t("reminderIntro", { organizer: organizerName, cup: cupName })
    : t("invitationIntro", { organizer: organizerName, cup: cupName });

  const highlight = isReminder
    ? renderHighlight(`<strong>${escapeHtml(t("awaited"))}</strong>
          <br />
          ${escapeHtml(t("counting"))}`)
    : renderHighlight(
        `<p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>${escapeHtml(t("asJuror"))}</strong>
        </p>
        <ul style="color: #92400e; margin: 8px 0 0 0; padding-left: 20px; font-size: 14px;">
          <li>${escapeHtml(t("can1"))}</li>
          <li>${escapeHtml(t("can2"))}</li>
          <li>${escapeHtml(t("can3"))}</li>
        </ul>`,
        true
      );

  const expires = t("expires", { date: strong(formatExpiry(expiresAt, locale)) });
  const expiryNotice = isReminder ? expires : `${expires}
        ${escapeHtml(t("ignore"))}`;

  return renderEmailLayout({
    locale,
    title: isReminder ? t("reminderTitle") : t("invitationTitle"),
    body: `
      ${renderGreeting(params.juryName, locale)}
      ${renderParagraph(intro)}
      ${customMessage ? renderQuote(customMessage) : ""}
      ${renderButton(invitationUrl, t("accept"))}
      ${renderFallbackLink(invitationUrl, locale)}
      ${highlight}

      <p style="color: #9ca3af; font-size: 14px; line-height: 1.5;">
        ${expiryNotice}
      </p>`,
  });
}

interface ReminderEmailParams {
  locale: Locale;
  juryName: string;
  cupName: string;
  organizerName: string;
  invitationUrl: string;
  expiresAt: Date;
}

function buildReminderEmailHtml(params: ReminderEmailParams): string {
  return buildInvitationEmailHtml(params, "reminder");
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
    const reminderCount = (jury.reminderCount ?? 0) + 1;
    await db
      .update(schema.cupJuries)
      .set({
        lastReminderAt: new Date(),
        reminderCount,
        updatedAt: new Date(),
      })
      .where(eq(schema.cupJuries.id, cupJuryId));

    // Build rating URL
    const portalBaseUrl = getPortalBaseUrl();
    const locale = recipientLocale(user.locale);
    const ratingUrl = `${portalBaseUrl}${localizePath(`/jury/cups/${cup.id}`, locale)}`;

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
    const result = await sendEmail({
      scope: "Jury Rating Reminder",
      ref: `user ${user.id}`,
      to: user.email,
      subject: juryT(locale)("ratingSubject", { cup: cup.name }),
      html: buildRatingReminderEmailHtml({
        locale,
        juryName: user.name ?? translatorFor(locale, "emails")("defaultJuror"),
        cupName: cup.name,
        organizerName: ORGANIZER_NAME,
        ratingUrl,
        completionStats,
      }),
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

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
  locale: Locale;
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
  const { ratingUrl, completionStats, locale } = params;
  const t = juryT(locale);

  const progressHtml = completionStats
    ? `
      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">
          ${escapeHtml(t("progress"))}
        </p>
        <div style="background-color: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
          <div style="background-color: #d4af37; height: 100%; width: ${completionStats.completionRate}%;"></div>
        </div>
        <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 12px;">
          ${escapeHtml(
            t("progressCount", {
              rated: completionStats.productsRated,
              total: completionStats.totalProductsToRate,
              rate: completionStats.completionRate,
            })
          )}
        </p>
      </div>
    `
    : "";

  return renderEmailLayout({
    locale,
    title: t("ratingTitle"),
    body: `
      ${renderGreeting(params.juryName, locale)}
      ${renderParagraph(t("ratingIntro", { organizer: strong(params.organizerName), cup: strong(params.cupName) }))}
      ${progressHtml}
      ${renderHighlight(`<strong>${escapeHtml(t("important"))}</strong>
          <br />
          ${escapeHtml(t("importantText"))}`)}
      ${renderButton(ratingUrl, t("continue"))}`,
    // Le lien de préférences pointe vers le profil du juré : un `href="#"`
    // laissait croire à un désabonnement possible depuis l'email.
    footerHtml: `${escapeHtml(ORGANIZER_NAME)} - ${escapeHtml(t("footerTagline"))}
        <br />
        <a href="${getPortalBaseUrl()}${localizePath("/jury/profile", locale)}" style="color: #9ca3af;">${escapeHtml(
          translatorFor(locale, "emails.productStatus")("preferences")
        )}</a>`,
  });
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
    const locale = recipientLocale(user.locale);
    const ratingUrl = `${portalBaseUrl}${localizePath(`/jury/cups/${cup.id}`, locale)}`;

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
    const result = await sendEmail({
      scope: "Jury Rating Sheet",
      ref: `user ${user.id}`,
      to: user.email,
      subject: juryT(locale)("sheetSubject", { cup: cup.name }),
      html: buildRatingSheetEmailHtml({
        locale,
        juryName: user.name ?? translatorFor(locale, "emails")("defaultJuror"),
        cupName: cup.name,
        organizerName: ORGANIZER_NAME,
        ratingUrl,
        categories: jury.categoryAssignments.map((a) => localizedField(a.category, "name", locale)),
        productsByCategory,
        totalProducts: products.length,
      }),
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

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
  // Parallélisme borné : 70 jurés en séquence dépassaient la coupure du proxy
  // à 100 s, l'UI affichant une erreur pendant que les envois continuaient.
  const results = await mapWithConcurrency(
    juriesData,
    EMAIL_SEND_CONCURRENCY,
    async (juryData) => {
      const result = await sendRatingSheet(juryData);
      return {
        juryId: juryData.cupJuryId,
        success: result.success,
        error: result.error,
      };
    }
  );

  const success = results.filter((r) => r.success).length;

  return { success, failed: results.length - success, results };
}

/**
 * Build rating sheet email HTML
 */
interface RatingSheetEmailParams {
  locale: Locale;
  juryName: string;
  cupName: string;
  organizerName: string;
  ratingUrl: string;
  categories: string[];
  productsByCategory: Map<string, string[]>;
  totalProducts: number;
}

function buildRatingSheetEmailHtml(params: RatingSheetEmailParams): string {
  const { ratingUrl, productsByCategory, totalProducts, locale } = params;
  const t = juryT(locale);
  const categories = params.categories.map(escapeHtml);

  // Build category list HTML
  let categoryListHtml = "";
  for (const [categoryName, productCodes] of productsByCategory) {
    categoryListHtml += `
      <div style="margin-bottom: 16px;">
        <p style="color: #374151; margin: 0 0 8px 0; font-weight: 600;">
          ${escapeHtml(t("categoryProducts", { category: categoryName, count: productCodes.length }))}
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${productCodes.map((code) => `
            <span style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #374151;">
              ${escapeHtml(code)}
            </span>
          `).join("")}
        </div>
      </div>
    `;
  }

  return renderEmailLayout({
    locale,
    title: t("sheetTitle"),
    body: `
      ${renderGreeting(params.juryName, locale)}
      ${renderParagraph(t("sheetIntro", { cup: strong(params.cupName), organizer: strong(params.organizerName) }))}

      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">
          ${escapeHtml(t("categories"))}
        </p>
        <ul style="color: #4b5563; margin: 0; padding-left: 20px; font-size: 14px;">
          ${categories.map((cat) => `<li>${cat}</li>`).join("")}
        </ul>
      </div>

      <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #374151; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">
          ${escapeHtml(t("toRate", { count: totalProducts }))}
        </p>
        ${categoryListHtml}
      </div>

      ${renderHighlight(`<strong>${escapeHtml(t("instructions"))}</strong>
          <br />
          ${escapeHtml(t("instructionsText"))}`)}
      ${renderButton(ratingUrl, t("start"))}`,
  });
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
    const locale = recipientLocale(user.locale);
    const dashboardUrl = `${portalBaseUrl}${localizePath("/jury/dashboard", locale)}`;
    const loginUrl = `${portalBaseUrl}${localizePath("/login", locale)}`;

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
    const result = await sendEmail({
      scope: "Jury Welcome Email",
      ref: `user ${user.id}`,
      to: user.email,
      subject: juryT(locale)("welcomeSubject", { cup: cup.name }),
      html: buildJuryWelcomeEmailHtml({
        locale,
        juryName: user.name,
        cupName: cup.name,
        organizerName: ORGANIZER_NAME,
        dashboardUrl,
        loginUrl,
      }),
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

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
  locale: Locale;
  juryName: string;
  cupName: string;
  organizerName: string;
  dashboardUrl: string;
  loginUrl: string;
}

function buildJuryWelcomeEmailHtml(params: JuryWelcomeEmailParams): string {
  const { loginUrl, locale } = params;
  const t = juryT(locale);

  return renderEmailLayout({
    locale,
    title: t("welcomeTitle"),
    body: `
      ${renderGreeting(params.juryName, locale)}
      ${renderParagraph(t("welcomeIntro", { cup: strong(params.cupName), organizer: strong(params.organizerName) }))}
      ${renderHighlight(
        `<p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>${escapeHtml(t("next"))}</strong>
        </p>
        <ul style="color: #92400e; margin: 8px 0 0 0; padding-left: 20px; font-size: 14px;">
          <li>${escapeHtml(t("next1"))}</li>
          <li>${escapeHtml(t("next2"))}</li>
          <li>${escapeHtml(t("next3"))}</li>
        </ul>`,
        true
      )}
      ${renderButton(loginUrl, t("access"))}

      <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin-top: 32px;">
        ${escapeHtml(t("keep"))}
      </p>`,
  });
}

/**
 * Juré existant ajouté directement à une cup par l'organisation (sans
 * invitation) : courte notification avec le lien vers son espace jury.
 */
export interface SendJuryAddedToCupEmailParams {
  userId: string;
  cupId: string;
  panel: "pro" | "public";
  categoryNames: string[];
}

export async function sendJuryAddedToCupEmail(
  params: SendJuryAddedToCupEmailParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, params.userId),
      columns: { id: true, name: true, email: true, locale: true },
    });
    if (!user) {
      return { success: false, error: "Utilisateur non trouve" };
    }

    const cup = await db.query.cups.findFirst({
      where: eq(schema.cups.id, params.cupId),
      columns: { id: true, name: true },
    });
    if (!cup) {
      return { success: false, error: "Cup non trouvee" };
    }

    const locale = recipientLocale(user.locale);
    const dashboardUrl = `${getPortalBaseUrl()}${localizePath("/jury/dashboard", locale)}`;

    if (env.NODE_ENV === "development") {
      console.log("\n" + "=".repeat(60));
      console.log("AJOUT JURY A UNE CUP (DEV MODE)");
      console.log("=".repeat(60));
      console.log("To:", user.email);
      console.log("Cup:", cup.name, `(${params.panel})`);
      console.log("Dashboard URL:", dashboardUrl);
      console.log("=".repeat(60) + "\n");
    }

    const result = await sendEmail({
      scope: "Jury Added To Cup",
      ref: `user ${user.id} cup ${cup.id}`,
      to: user.email,
      subject: juryT(locale)("addedSubject", { cup: cup.name }),
      html: buildJuryAddedToCupEmailHtml({
        locale,
        juryName: user.name,
        cupName: cup.name,
        panel: params.panel,
        categoryNames: params.categoryNames,
        dashboardUrl,
      }),
    });

    return result.success ? { success: true } : { success: false, error: result.error };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Jury Added To Cup] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export function buildJuryAddedToCupEmailHtml(params: {
  juryName: string;
  cupName: string;
  panel: "pro" | "public";
  categoryNames: string[];
  dashboardUrl: string;
  locale?: Locale;
}): string {
  const locale = params.locale ?? "fr";
  const t = juryT(locale);
  const panelLabel = params.panel === "pro" ? t("panelPro") : t("panelPublic");
  const categories =
    params.categoryNames.length > 0
      ? renderParagraph(
          t("categoriesToRate", {
            count: params.categoryNames.length,
            list: `<strong>${params.categoryNames.map(escapeHtml).join(", ")}</strong>`,
          })
        )
      : "";

  return renderEmailLayout({
    locale,
    title: t("addedTitle"),
    body: `
      ${renderGreeting(params.juryName, locale)}
      ${renderParagraph(t("addedIntro", { panel: strong(panelLabel), cup: strong(params.cupName) }))}
      ${categories}
      ${renderButton(params.dashboardUrl, t("access"))}
      ${renderFallbackLink(params.dashboardUrl, locale)}`,
  });
}
