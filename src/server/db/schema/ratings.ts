import { pgTable, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { products } from "./products";
import { cupJuries } from "./juries";
import { ratingCriteria } from "./rating-criteria";

/**
 * Product Ratings table - Overall rating for a product by a jury
 * Multi-tenant: each rating belongs to a product (which belongs to a cup → organization)
 *
 * Stores the jury's rating submission including optional comment and submission timestamp.
 * Individual criterion scores are stored in the criterionScores table.
 */
export const productRatings = pgTable(
  "product_ratings",
  {
    id: text("id").primaryKey(), // nanoid generated
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    juryId: text("jury_id")
      .notNull()
      .references(() => cupJuries.id, { onDelete: "cascade" }),
    // Optional global comment for the product
    comment: text("comment"),
    // Submission status - null means draft, set when jury finalizes rating
    submittedAt: timestamp("submitted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // A jury can only rate a product once
    unique("product_rating_product_jury_unique").on(table.productId, table.juryId),
  ]
);

/**
 * Criterion Scores table - Individual scores for each criterion
 * Each score belongs to a product rating and a criterion.
 */
export const criterionScores = pgTable(
  "criterion_scores",
  {
    id: text("id").primaryKey(), // nanoid generated
    productRatingId: text("product_rating_id")
      .notNull()
      .references(() => productRatings.id, { onDelete: "cascade" }),
    criterionId: text("criterion_id")
      .notNull()
      .references(() => ratingCriteria.id, { onDelete: "cascade" }),
    // Score value (1-10 scale)
    score: integer("score").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // A criterion can only be scored once per product rating
    unique("criterion_score_rating_criterion_unique").on(
      table.productRatingId,
      table.criterionId
    ),
  ]
);

/**
 * Product Ratings relations for Drizzle query builder
 */
export const productRatingsRelations = relations(productRatings, ({ one, many }) => ({
  product: one(products, {
    fields: [productRatings.productId],
    references: [products.id],
  }),
  jury: one(cupJuries, {
    fields: [productRatings.juryId],
    references: [cupJuries.id],
  }),
  scores: many(criterionScores),
}));

/**
 * Criterion Scores relations for Drizzle query builder
 */
export const criterionScoresRelations = relations(criterionScores, ({ one }) => ({
  productRating: one(productRatings, {
    fields: [criterionScores.productRatingId],
    references: [productRatings.id],
  }),
  criterion: one(ratingCriteria, {
    fields: [criterionScores.criterionId],
    references: [ratingCriteria.id],
  }),
}));

// Type exports for use in other parts of the application
export type ProductRating = typeof productRatings.$inferSelect;
export type NewProductRating = typeof productRatings.$inferInsert;
export type CriterionScore = typeof criterionScores.$inferSelect;
export type NewCriterionScore = typeof criterionScores.$inferInsert;
