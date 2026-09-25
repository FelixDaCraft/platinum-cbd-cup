/**
 * Gabarit commun des emails transactionnels.
 *
 * Le wrapper, l'en-tête de marque et le pied étaient recopiés dans onze
 * templates : tout changement de marque, de couleur ou de mention légale
 * devait être répété onze fois. Chaque template ne décrit plus que son corps.
 */

import { ORGANIZATION_NAME } from "~/lib/organization";

import { escapeHtml, safeUrl } from "./escape";

/** Or de la charte Platinum, repris sur les titres et les boutons. */
const BRAND_GOLD = "#d4af37";

const DEFAULT_FOOTER = `${ORGANIZATION_NAME} - Le concours de reference des meilleurs CBD`;

export interface EmailLayoutParams {
  /** Titre affiché en tête du corps. Échappé. */
  title: string;
  /** Corps de l'email, HTML déjà assemblé et échappé par l'appelant. */
  body: string;
  /**
   * Pied de page, HTML. Par défaut la signature du concours ; à surcharger
   * pour les emails qui doivent porter un lien de préférences.
   */
  footerHtml?: string;
}

/**
 * Assemble un email complet : wrapper, en-tête de marque, titre, corps, pied.
 */
export function renderEmailLayout(params: EmailLayoutParams): string {
  const { body } = params;
  const title = escapeHtml(params.title);
  const footerHtml = params.footerHtml ?? escapeHtml(DEFAULT_FOOTER);

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: ${BRAND_GOLD}; font-size: 32px; margin: 0;">
          ${escapeHtml(ORGANIZATION_NAME)}
        </h1>
      </div>

      <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 16px;">
        ${title}
      </h2>

      ${body}

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        ${footerHtml}
      </p>
    </div>
  `;
}

/** Paragraphe courant du corps. `content` est du HTML déjà échappé. */
export function renderParagraph(content: string): string {
  return `
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        ${content}
      </p>`;
}

/** « Bonjour X, » — le nom est échappé ici, les appelants passent le brut. */
export function renderGreeting(name: string): string {
  return renderParagraph(`Bonjour ${escapeHtml(name)},`);
}

/** Bouton d'action principal. L'URL est filtrée par `safeUrl`. */
export function renderButton(url: string, label: string): string {
  return `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${safeUrl(url)}"
           style="display: inline-block; background-color: ${BRAND_GOLD}; color: #0a0a0f; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          ${escapeHtml(label)}
        </a>
      </div>`;
}

/** Lien brut proposé en repli sous le bouton, pour les clients qui bloquent. */
export function renderFallbackLink(url: string): string {
  const href = safeUrl(url);
  return `
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-bottom: 24px;">
        Ou copiez ce lien : <a href="${href}" style="color: ${BRAND_GOLD};">${href}</a>
      </p>`;
}

export interface CalloutParams {
  /** Contenu HTML. Enrobé d'un `<p>` sauf si `block` est vrai. */
  content: string;
  background: string;
  textColor: string;
  /** Liseré gauche, omis pour un encadré plein. */
  borderColor?: string;
  /**
   * Vrai quand le contenu porte lui-même sa structure (liste, plusieurs
   * paragraphes) : le `<p>` par défaut produirait un HTML mal imbriqué.
   */
  block?: boolean;
}

/** Encadré coloré (information, alerte, mise en avant). */
export function renderCallout(params: CalloutParams): string {
  const { content, background, textColor, borderColor, block } = params;
  const border = borderColor ? ` border-left: 4px solid ${borderColor};` : "";
  const inner = block
    ? content
    : `<p style="color: ${textColor}; margin: 0; font-size: 14px;">
          ${content}
        </p>`;

  return `
      <div style="background-color: ${background}; border-radius: 8px; padding: 16px; margin-bottom: 24px;${border}">
        ${inner}
      </div>`;
}

/** Encadré ambre, utilisé pour les rappels et les mises en avant. */
export function renderHighlight(content: string, block = false): string {
  return renderCallout({
    content,
    background: "#fef3c7",
    textColor: "#92400e",
    block,
  });
}

/** Message libre saisi par l'organisateur, rendu en citation. */
export function renderQuote(message: string): string {
  return `
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid ${BRAND_GOLD};">
        <p style="color: #4b5563; margin: 0; font-size: 14px; font-style: italic;">
          "${escapeHtml(message)}"
        </p>
      </div>`;
}
