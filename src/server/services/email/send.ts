/**
 * Envoi d'email transactionnel : point de passage unique.
 *
 * Le bloc « send, tester result.error, logger, retourner {success:false} »
 * était recopié huit fois avec des variantes silencieuses. Le centraliser
 * garantit un comportement d'erreur et un format de log identiques partout.
 */

import { env } from "~/env";

import { getResendClient } from "./client";

export interface SendEmailParams {
  to: string;
  subject: string;
  /** Corps HTML complet, généralement issu de `renderEmailLayout`. */
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
  /** Préfixe des logs, p. ex. "Jury Invitation". */
  scope: string;
  /**
   * Identifiant technique cité dans les logs de succès. Jamais une adresse
   * email : les journaux Docker ne sont ni chiffrés ni purgés (RGPD).
   */
  ref?: string;
}

export interface SendEmailResult {
  success: boolean;
  /** Identifiant Resend du message, absent en repli de développement. */
  id?: string;
  error?: string;
  /**
   * Vrai quand l'envoi a échoué mais que le mode développement l'absout : les
   * liens utiles ont été écrits en console, le flux applicatif peut continuer.
   */
  devFallback?: boolean;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, html, attachments, scope, ref } = params;
  const suffix = ref ? ` (${ref})` : "";

  try {
    const result = await getResendClient().emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      ...(attachments ? { attachments } : {}),
    });

    if (result.error) {
      console.error(`[${scope}] Resend error:`, result.error);

      // En développement la clé Resend est souvent absente ou le domaine non
      // vérifié : l'échec ne doit pas bloquer le parcours, les URL utiles
      // ayant déjà été journalisées par l'appelant.
      if (env.NODE_ENV === "development") {
        console.warn(`[${scope}] Email non envoye (mode developpement)`);
        return { success: true, devFallback: true };
      }

      return { success: false, error: result.error.message };
    }

    console.log(`[${scope}] Email sent successfully${suffix}`);
    return { success: true, id: result.data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${scope}] Error:`, message);
    return { success: false, error: message };
  }
}
