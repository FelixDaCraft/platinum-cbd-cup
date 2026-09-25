import { Resend } from "resend";

import { env } from "~/env";

/**
 * Point d'entrée unique pour les emails transactionnels.
 *
 * Better Auth appelle ses callbacks d'envoi via `runInBackgroundOrAwait`, qui
 * enveloppe la promesse dans un try/catch et se contente de journaliser
 * « Failed to run background task » : une inscription répond 200 « vérifiez
 * votre email » même quand Resend refuse (403 sur domaine non vérifié, quota
 * dépassé…). On ne peut pas remonter l'échec à l'appelant depuis là ; on peut
 * en revanche garantir qu'il laisse une trace exploitable.
 *
 * D'où ce module : un seul endroit qui construit le client Resend, journalise
 * chaque échec sous un préfixe unique et grepable (`[email] ÉCHEC`), et
 * servira de point d'accroche quand une table `email_events` + le webhook
 * Resend seront branchés (voir QO-18).
 */

const resend = new Resend(env.RESEND_API_KEY);

/** Préfixe unique des lignes d'échec, à surveiller dans les logs du conteneur. */
const FAILURE_LOG_PREFIX = "[email] ÉCHEC";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /**
   * Identifiant du gabarit (`verification`, `reset-password`, …). Sert à
   * retrouver un envoi dans les logs et deviendra la colonne `template` de
   * la future table d'événements.
   */
  template: string;
}

export interface SendEmailResult {
  success: boolean;
  /** Identifiant Resend du message, seule preuve qu'il est bien parti. */
  id?: string;
  error?: string;
}

/**
 * Envoie un email et journalise systématiquement le résultat.
 *
 * Ne lève jamais : c'est à l'appelant de décider s'il propage l'échec. Les
 * callbacks Better Auth relancent en production pour que l'erreur remonte au
 * moins dans les logs du framework, et restent silencieuses en développement
 * où l'URL est déjà affichée en console.
 */
export async function sendEmail({
  to,
  subject,
  html,
  template,
}: SendEmailInput): Promise<SendEmailResult> {
  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error(
        `${FAILURE_LOG_PREFIX} template=${template} to=${to} raison=${result.error.message}`
      );
      return { success: false, error: result.error.message };
    }

    if (env.NODE_ENV === "development") {
      console.log(`[email] envoyé template=${template} to=${to} id=${result.data?.id}`);
    }

    return { success: true, id: result.data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `${FAILURE_LOG_PREFIX} template=${template} to=${to} raison=${message}`
    );
    return { success: false, error: message };
  }
}

/**
 * Échappe une valeur utilisateur avant de l'insérer dans le corps HTML d'un
 * email (une adresse choisie par l'attaquant arrive jusque dans le mail de
 * confirmation de changement d'adresse).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface AuthEmailTemplate {
  /** Titre affiché en gros sous le bandeau. */
  title: string;
  /** Paragraphe d'introduction — fragment HTML déjà échappé. */
  intro: string;
  cta: { label: string; url: string };
  /** Mention de bas de page — fragment HTML déjà échappé. */
  footnote: string;
}

/**
 * Gabarit commun aux emails d'authentification (vérification, réinitialisation
 * de mot de passe, changement d'adresse). Or #d4af37 de la charte Platinum.
 */
export function renderAuthEmail({
  title,
  intro,
  cta,
  footnote,
}: AuthEmailTemplate): string {
  return `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #d4af37; font-size: 32px; margin: 0;">Platinum CBD Cup</h1>
              </div>
              <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">${title}</h2>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                ${intro}
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${cta.url}" style="display: inline-block; background-color: #d4af37; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  ${cta.label}
                </a>
              </div>
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin-top: 32px;">
                ${footnote}
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">Platinum CBD Cup</p>
            </div>
          `;
}
