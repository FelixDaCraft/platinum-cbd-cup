import { pgTable, text, timestamp, integer, index, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { generateId } from "./id";
import { categories } from "./categories";
import type { JuryPanel } from "./juries";

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
    /**
     * Jury qui note ce critère. Le jury pro et le jury public ont chacun leur
     * propre grille (2026 : 9 critères pro, 5 publics par catégorie) ; un
     * juré ne voit que les critères de son panel.
     */
    panel: text("panel").notNull().$type<JuryPanel>().default("pro"),
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
    index("rating_criteria_category_panel_idx").on(table.categoryId, table.panel),
    check("rating_criteria_panel_check", sql`${table.panel} in ('pro', 'public')`),
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
