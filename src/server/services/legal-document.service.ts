import type { db as Database } from "~/server/db";
import type { LegalDocumentSlug } from "~/server/db/schema/legal-documents";
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
}

const DEFAULTS: Record<LegalDocumentSlug, Omit<LegalDocumentView, "slug" | "isCustom">> = {
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
    };
  }
  return { slug, ...DEFAULTS[slug], isCustom: false };
}
