import { pgTable, text, timestamp, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

/** Documents légaux éditables depuis le back-office. */
export const legalDocumentSlugs = ["reglement"] as const;
export type LegalDocumentSlug = (typeof legalDocumentSlugs)[number];

/**
 * Textes légaux rédigés par l'organisateur (aujourd'hui : le règlement —
 * conditions de participation). Une ligne par document ; tant qu'elle
 * n'existe pas, le portail affiche le texte par défaut livré avec le code
 * (src/lib/legal/reglement-default.ts).
 */
export const legalDocuments = pgTable(
  "legal_documents",
  {
    slug: text("slug").primaryKey().$type<LegalDocumentSlug>(),
    title: text("title").notNull(),
    /** Chapeau affiché sous le titre. */
    lede: text("lede"),
    /** Corps au format TipTap (JSON), comme les articles. */
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    check("legal_documents_slug_check", sql`${table.slug} in ('reglement')`),
  ]
);

export type LegalDocument = typeof legalDocuments.$inferSelect;
