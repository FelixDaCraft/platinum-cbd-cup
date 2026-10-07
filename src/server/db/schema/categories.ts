import { pgTable, text, timestamp, integer, index, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
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
    // Quotas d'inscription (null = pas de limite).
    // `maxProducts` : places de la catégorie, tous producteurs confondus. Une
    // place est prise par un produit payé, ou réservée par un paiement en cours
    // (voir `registrations.payment_reserved_until`).
    maxProducts: integer("max_products"),
    // Nombre de produits qu'un même producteur peut inscrire dans la catégorie.
    maxProductsPerProducer: integer("max_products_per_producer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Toutes les listes de catégories filtrent par cup.
    index("categories_cup_id_idx").on(table.cupId),
    check("categories_max_products_check", sql`${table.maxProducts} is null or ${table.maxProducts} > 0`),
    check(
      "categories_max_products_per_producer_check",
      sql`${table.maxProductsPerProducer} is null or ${table.maxProductsPerProducer} > 0`
    ),
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
