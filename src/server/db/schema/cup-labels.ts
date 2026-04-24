import { pgTable, text, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cups } from "./cups";

/**
 * Cup Labels table - 100% CUSTOMIZABLE labels for cups
 * Multi-tenant: each label belongs to a cup (which belongs to an organization)
 *
 * ⚠️ IMPORTANT: Labels are NOT predefined (Bronze/Argent/Or).
 * Each organizer defines their own labels with custom names, icons, and conditions.
 * Examples: "Excellence", "Coup de Cœur", "Mention Spéciale", "Grand Prix du Jury"
 *
 * Score semantics (inclusive bounds with decimals):
 * - minScore: Lower bound (inclusive), supports 1 decimal (e.g., 3.0)
 * - maxScore: Upper bound (inclusive), supports 1 decimal (e.g., 3.9), or null for "no upper limit"
 *
 * Example label ranges (scale 0-20):
 * - "Bronze": 10.0-13.9 (scores from 10.0 to 13.9 inclusive)
 * - "Argent": 14.0-16.9 (scores from 14.0 to 16.9 inclusive)
 * - "Or": 17.0-null (scores 17.0 and above)
 */
export const cupLabels = pgTable("cup_labels", {
  id: text("id").primaryKey(), // nanoid generated
  cupId: text("cup_id")
    .notNull()
    .references(() => cups.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Custom name: "Excellence", "Coup de Cœur", etc.
  minScore: real("min_score").notNull(), // Decimal score (e.g., 3.0, 10.5)
  maxScore: real("max_score"), // null = no upper limit (e.g., "17+")
  sortOrder: integer("sort_order").notNull().default(0),
  color: text("color"), // Hex color like "#FFD700" for badge display
  icon: text("icon"), // URL to icon image or emoji (e.g., "🏆", "/icons/gold.svg")
  condition: text("condition"), // Human-readable condition text (e.g., "Score ≥ 17/20")
  isPublic: boolean("is_public").notNull().default(true), // Visible on public portal
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Cup Labels relations for Drizzle query builder
 */
export const cupLabelsRelations = relations(cupLabels, ({ one }) => ({
  cup: one(cups, {
    fields: [cupLabels.cupId],
    references: [cups.id],
  }),
}));

// Type exports for use in other parts of the application
export type CupLabel = typeof cupLabels.$inferSelect;
export type NewCupLabel = typeof cupLabels.$inferInsert;
