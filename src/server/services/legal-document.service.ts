import type { db as Database } from "~/server/db";
import type { LegalDocumentSlug } from "~/server/db/schema/legal-documents";
import type { ContentTranslations, Locale } from "~/i18n/locales";
import { REGLEMENT_TRANSLATIONS } from "~/lib/legal/reglement-translations";
import {
  tiptapFingerprint,
  translateTiptap,
  type TipTapNode,
} from "~/lib/legal/tiptap-translate";
import {
  DEFAULT_REGLEMENT_CONTENT,
  DEFAULT_REGLEMENT_LEDE,
  DEFAULT_REGLEMENT_TITLE,
  DEFAULT_REGLEMENT_UPDATED_AT,
} from "~/lib/legal/reglement-default";

export interface LegalDocumentView {
  slug: LegalDocumentSlug;
  title: string;
  lede: string | null;
  content: Record<string, unknown>;
  updatedAt: Date;
  /** false tant que l'organisateur n'a rien enregistré (texte par défaut). */
  isCustom: boolean;
  /** Traductions enregistrées (voir scripts/import-translations.ts). */
  translations: ContentTranslations;
}

const DEFAULTS: Record<
  LegalDocumentSlug,
  Omit<LegalDocumentView, "slug" | "isCustom" | "translations">
> = {
  reglement: {
    title: DEFAULT_REGLEMENT_TITLE,
    lede: DEFAULT_REGLEMENT_LEDE,
    content: DEFAULT_REGLEMENT_CONTENT as unknown as Record<string, unknown>,
    updatedAt: DEFAULT_REGLEMENT_UPDATED_AT,
  },
};

/** Version enregistrée du document, sinon le texte par défaut. */
export async function getLegalDocument(
  db: typeof Database,
  slug: LegalDocumentSlug
): Promise<LegalDocumentView> {
  const row = await db.query.legalDocuments.findFirst({
    where: (d, { eq }) => eq(d.slug, slug),
  });
  if (row) {
    return {
      slug,
      title: row.title,
      lede: row.lede,
      content: row.content,
      updatedAt: row.updatedAt,
      isCustom: true,
      translations: row.translations ?? {},
    };
  }
  return { slug, ...DEFAULTS[slug], isCustom: false, translations: {} };
}

export interface LocalizedLegalDocument {
  title: string;
  lede: string | null;
  content: Record<string, unknown>;
  /**
   * `translated` : texte dans la langue demandée (ou français demandé) ;
   * `french` : pas de traduction à jour, le texte français est affiché.
   */
  status: "translated" | "french";
}

/**
 * Version d'un document légal dans une langue, par ordre de préférence :
 * 1. la traduction enregistrée en base, si elle a été faite sur le texte
 *    français actuel (même empreinte) ;
 * 2. la traduction fournie avec le code (reglement-translations.ts), si le
 *    texte français est celui qu'elle traduit ;
 * 3. sinon le texte français, signalé comme tel : une traduction périmée
 *    d'un texte contractuel serait pire que pas de traduction.
 */
export function localizeLegalDocument(
  doc: LegalDocumentView,
  locale: Locale
): LocalizedLegalDocument {
  const french: LocalizedLegalDocument = {
    title: doc.title,
    lede: doc.lede,
    content: doc.content,
    status: locale === "fr" ? "translated" : "french",
  };
  if (locale === "fr") return french;

  const fingerprint = tiptapFingerprint(doc.content as TipTapNode);

  const stored = doc.translations[locale];
  if (
    stored?.content &&
    Object.keys(stored.content).length > 0 &&
    stored.sourceFingerprint === fingerprint
  ) {
    return {
      title: stored.title?.trim() || doc.title,
      lede: stored.lede?.trim() || doc.lede,
      content: stored.content,
      status: "translated",
    };
  }

  if (doc.slug === "reglement") {
    const bundled = REGLEMENT_TRANSLATIONS[locale];
    if (bundled.sourceFingerprint === fingerprint) {
      const content = translateTiptap(doc.content as TipTapNode, bundled.texts, locale);
      if (content) {
        return {
          title: bundled.title,
          lede: bundled.lede,
          content: content as Record<string, unknown>,
          status: "translated",
        };
      }
    }
  }

  return french;
}
