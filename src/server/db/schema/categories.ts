import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { generateId } from "./id";
import { cups } from "./cups";
import { ratingCriteria } from "./rating-criteria";

/**
 * Categories table - Product categories for cups
 * Chaque catégorie appartient à une cup.
 */
export const categories = pgTable(
  "categories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    cupId: text("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    // Pricing override (null = use cup's default price)
    priceOverride: integer("price_override"), // Price in cents, nullable
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Toutes les listes de catégories filtrent par cup.
    index("categories_cup_id_idx").on(table.cupId),
  ]
);

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
