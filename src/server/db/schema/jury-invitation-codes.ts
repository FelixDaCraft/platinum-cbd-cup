import { pgTable, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
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
export const juryInvitationCodes = pgTable(
  "jury_invitation_codes",
  {
    id: text("id").primaryKey(), // nanoid generated
    cupId: text("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "cascade" }),
    // Short readable code like "FLR-7X9-KM2"
    code: text("code").notNull().unique(),
    // Status of the invitation code
    status: text("status").notNull().$type<JuryCodeStatus>().default("pending"),
    // Destination/store where this code pack was sent (for tracking)
    destination: text("destination"),
    // User who activated this code (becomes jury)
    activatedByUserId: text("activated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    activatedAt: timestamp("activated_at"),
    // Expiration date (typically the cup's ratingEndAt)
    expiresAt: timestamp("expires_at"),
    // Metadata
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("jury_invitation_codes_cup_id_idx").on(table.cupId),
    index("jury_invitation_codes_code_idx").on(table.code),
    index("jury_invitation_codes_status_idx").on(table.status),
    index("jury_invitation_codes_destination_idx").on(table.destination),
  ]
);

/**
 * Junction table for jury invitation codes and categories
 * A single code can give access to multiple categories
 */
export const juryInvitationCodeCategories = pgTable(
  "jury_invitation_code_categories",
  {
    id: text("id").primaryKey(), // nanoid generated
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
