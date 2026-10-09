import { pgTable, text, timestamp, boolean, index, unique, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { generateId } from "./id";
import { cups } from "./cups";
import { categories } from "./categories";
import { users } from "./auth";

/**
 * Jury invitation code status enum
 * - pending: Code generated but not yet used
 * - activated: Code has been activated by a jury member
 * - revoked: Code has been revoked by the organizer
 * - expired: Code has expired (past rating end date)
 */
export const juryCodeStatusEnum = ["pending", "activated", "revoked", "expired"] as const;
export type JuryCodeStatus = (typeof juryCodeStatusEnum)[number];

/**
 * Jury invitation codes table
 * Used for public cups where jury members are not known in advance
 * They receive a code (via QR or text) that they can use to register as jury
 */
/**
 * Codes d'invitation jurés — À NE PAS FUSIONNER avec `public_jury_tokens`.
 *
 * Les audits successifs proposent de réunir les deux tables, qui se
 * ressemblent de loin. Elles couvrent deux canaux de distribution distincts :
 *
 *   - `public_jury_tokens` : un QR code, rattaché à UNE catégorie
 *     (`category_id` NOT NULL), généré par lots (`batch_id`), avec une date
 *     d'expiration obligatoire.
 *   - `jury_invitation_codes` (ici) : un code lisible à la main
 *     ("FLR-7X9-KM2"), imprimé et envoyé à une boutique (`destination`),
 *     couvrant PLUSIEURS catégories via `jury_invitation_code_categories`,
 *     à expiration facultative.
 *
 * Les réunir donnerait une table où `category_id`, `destination` et `batch_id`
 * sont tous nullables, avec deux formats de jeton mutuellement exclusifs et un
 * cycle de vie qui est l'union de deux cycles ('available/claimed' d'un côté,
 * 'pending/activated/revoked/expired' de l'autre). C'est une table large à
 * colonnes optionnelles, pas une consolidation — et les deux parcours jurés
 * sont parmi les plus sensibles de l'application.
 *
 * Depuis la refonte « mise en place des jurys », les codes sont le SEUL
 * mécanisme public : les jetons ne sont plus générés (option
 * `samples_included` à la place), les jetons déjà imprimés restent
 * réclamables. Les tables restent séparées, sans migration de données.
 */
export const juryInvitationCodes = pgTable(
  "jury_invitation_codes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    cupId: text("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "cascade" }),
    // Short readable code like "FLR-7X9-KM2"
    code: text("code").notNull().unique(),
    // Status of the invitation code
    status: text("status").notNull().$type<JuryCodeStatus>().default("pending"),
    // Destination/store where this code pack was sent (for tracking)
    destination: text("destination"),
    // « Échantillons inclus » : le QR est glissé dans la boîte d'échantillons,
    // la réception est donc acquise dès l'activation (samplesReceivedAt posé).
    samplesIncluded: boolean("samples_included").notNull().default(false),
    // User who activated this code (becomes jury)
    activatedByUserId: text("activated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    // Expiration date (typically the cup's ratingEndAt)
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("jury_invitation_codes_cup_id_idx").on(table.cupId),
    // Pas d'index sur `code` : le .unique() de la colonne en crée déjà un.
    index("jury_invitation_codes_status_idx").on(table.status),
    index("jury_invitation_codes_destination_idx").on(table.destination),
    index("jury_invitation_codes_activated_by_user_id_idx").on(table.activatedByUserId),
    check("jury_invitation_codes_status_check", sql`${table.status} in ('pending', 'activated', 'revoked', 'expired')`),
  ]
);

/**
 * Junction table for jury invitation codes and categories
 * A single code can give access to multiple categories
 */
export const juryInvitationCodeCategories = pgTable(
  "jury_invitation_code_categories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    codeId: text("code_id")
      .notNull()
      .references(() => juryInvitationCodes.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [
    // A category can only be assigned once per code
    unique("jury_code_category_unique").on(table.codeId, table.categoryId),
    index("jury_invitation_code_categories_code_id_idx").on(table.codeId),
    index("jury_invitation_code_categories_category_id_idx").on(table.categoryId),
  ]
);

/**
 * Relations for jury invitation codes
 */
export const juryInvitationCodesRelations = relations(juryInvitationCodes, ({ one, many }) => ({
  cup: one(cups, {
    fields: [juryInvitationCodes.cupId],
    references: [cups.id],
  }),
  activatedBy: one(users, {
    fields: [juryInvitationCodes.activatedByUserId],
    references: [users.id],
  }),
  categories: many(juryInvitationCodeCategories),
}));

/**
 * Relations for jury invitation code categories
 */
export const juryInvitationCodeCategoriesRelations = relations(
  juryInvitationCodeCategories,
  ({ one }) => ({
    code: one(juryInvitationCodes, {
      fields: [juryInvitationCodeCategories.codeId],
      references: [juryInvitationCodes.id],
    }),
    category: one(categories, {
      fields: [juryInvitationCodeCategories.categoryId],
      references: [categories.id],
    }),
  })
);

// Type exports
export type JuryInvitationCode = typeof juryInvitationCodes.$inferSelect;
export type NewJuryInvitationCode = typeof juryInvitationCodes.$inferInsert;
export type JuryInvitationCodeCategory = typeof juryInvitationCodeCategories.$inferSelect;
export type NewJuryInvitationCodeCategory = typeof juryInvitationCodeCategories.$inferInsert;
