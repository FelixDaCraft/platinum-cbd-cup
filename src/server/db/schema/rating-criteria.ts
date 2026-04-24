import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { categories } from "./categories";

/**
 * Rating Criteria table - Evaluation criteria for categories
 * Multi-tenant: each criterion belongs to a category (which belongs to a cup → organization)
 *
 * Used by juries to evaluate products in a category.
 * Each criterion has a name, optional description, and a coefficient (weight).
 */
export const ratingCriteria = pgTable("rating_criteria", {
  id: text("id").primaryKey(), // nanoid generated
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Aspect visuel", "Arôme", "Goût", etc.
  description: text("description"), // Detailed description for juries
  coefficient: integer("coefficient").notNull().default(1), // Weight 1-10
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
