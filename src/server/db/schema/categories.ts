import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cups } from "./cups";
import { ratingCriteria } from "./rating-criteria";

/**
 * Categories table - Product categories for cups
 * Multi-tenant: each category belongs to a cup (which belongs to an organization)
 */
export const categories = pgTable("categories", {
  id: text("id").primaryKey(), // nanoid generated
  cupId: text("cup_id")
    .notNull()
    .references(() => cups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  // Pricing override (null = use cup's default price)
  priceOverride: integer("price_override"), // Price in cents, nullable
  // [DEPRECATED] Rating scale is now configured at Cup level (cups.ratingScale)
  // These fields are kept for backwards compatibility but are NOT used
  // See: src/server/db/schema/cups.ts → ratingScale field
  ratingScaleMin: integer("rating_scale_min").notNull().default(1),
  ratingScaleMax: integer("rating_scale_max").notNull().default(10),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Categories relations for Drizzle query builder
 */
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  cup: one(cups, {
    fields: [categories.cupId],
    references: [cups.id],
  }),
  criteria: many(ratingCriteria),
}));

// Type exports for use in other parts of the application
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
