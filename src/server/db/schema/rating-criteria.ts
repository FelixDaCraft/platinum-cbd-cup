import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { generateId } from "./id";
import { categories } from "./categories";

/**
 * Rating Criteria table - Evaluation criteria for categories
 * Chaque critère appartient à une catégorie (donc à une cup).
 *
 * Used by juries to evaluate products in a category.
 * Each criterion has a name, optional description, and a coefficient (weight).
 */
export const ratingCriteria = pgTable(
  "rating_criteria",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Aspect visuel", "Arôme", "Goût", etc.
    description: text("description"), // Detailed description for juries
    coefficient: integer("coefficient").notNull().default(1), // Weight 1-10
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // La grille de notation charge les critères d'une catégorie.
    index("rating_criteria_category_id_idx").on(table.categoryId),
  ]
);

/**
 * Rating Criteria relations for Drizzle query builder
 */
export const ratingCriteriaRelations = relations(ratingCriteria, ({ one }) => ({
  category: one(categories, {
    fields: [ratingCriteria.categoryId],
    references: [categories.id],
  }),
}));

// Type exports for use in other parts of the application
export type RatingCriterion = typeof ratingCriteria.$inferSelect;
export type NewRatingCriterion = typeof ratingCriteria.$inferInsert;
