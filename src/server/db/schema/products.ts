import { pgTable, text, timestamp, integer, unique, numeric, boolean, index, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { generateId } from "./id";
import { registrations } from "./registrations";
import { categories } from "./categories";
import { cupLabels } from "./cup-labels";

/**
 * Product status enum values
 * - pending: En attente de reception des echantillons
 * - received: Echantillons recus par l'organisateur
 * - rating: En cours de notation par les jurys
 * - rated: Produit note par les jurys
 */
export const productStatusEnum = ["pending", "received", "rating", "rated"] as const;
export type ProductStatus = (typeof productStatusEnum)[number];

/**
 * Products table - Products registered by producers for a cup
 * Each product belongs to a registration and a category
 */
export const products = pgTable(
  "products",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    registrationId: text("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }), // Don't delete category if products exist
    name: text("name").notNull(),
    description: text("description"),
    // Price frozen at registration time (in cents)
    // This captures the price when the product was added, even if category price changes later
    priceAtRegistration: integer("price_at_registration").notNull(),
    status: text("status")
      .notNull()
      .$type<ProductStatus>()
      .default("pending"),
    // Codes anonymes, un par panel de jury (format : initiales de catégorie +
    // nombre, ex. CF23). Chaque panel note sous son propre code : un juré pro
    // et un juré public ne peuvent pas recouper leurs échantillons. Générés à
    // la confirmation du paiement, null avant. Les deux codes d'un produit
    // sont distincts entre eux et de tous ceux de la catégorie, quel que soit
    // le panel, pour qu'aucune étiquette ne prête à confusion en réception.
    anonymousCodePro: text("anonymous_code_pro"),
    anonymousCodePublic: text("anonymous_code_public"),
    // Timestamp when the product was received (set when status changes to "received")
    receivedAt: timestamp("received_at", { withTimezone: true }),
    // Résultats calculés à la publication, un jeu par panel (échelle 0-100).
    // Score = moyenne des moyennes pondérées des jurés du panel.
    finalScorePro: numeric("final_score_pro", { precision: 5, scale: 2 }),
    finalScorePublic: numeric("final_score_public", { precision: 5, scale: 2 }),
    // Rang dans la catégorie, au sein du panel (1 = meilleur score).
    categoryRankPro: integer("category_rank_pro"),
    categoryRankPublic: integer("category_rank_public"),
    // Label attribué d'après le score du jury PUBLIC : le jury pro ne décerne
    // pas de label. (Sur les éditions antérieures à la cup unique, les cups
    // « pro » portent encore les labels calculés à l'époque.)
    labelId: text("label_id").references(() => cupLabels.id, { onDelete: "set null" }),
    // Excluded from public results (hidden entirely from the palmarès).
    excludedFromResults: boolean("excluded_from_results").notNull().default(false),
    // Disqualified (cheating / rule violation): still listed publicly but shown
    // as "DISQUALIFIÉ" at the bottom of its category — no score, no rank, no
    // label — and excluded from every ranking (podium, best-in-show, widget…).
    disqualified: boolean("disqualified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Code unique par catégorie et par panel (le même code peut exister dans
    // deux catégories ; l'unicité croisée entre panels est assurée à la
    // génération, sous verrou).
    unique("product_anonymous_code_pro_category_unique").on(
      table.categoryId,
      table.anonymousCodePro
    ),
    unique("product_anonymous_code_public_category_unique").on(
      table.categoryId,
      table.anonymousCodePublic
    ),
    // Jointure la plus fréquente (palmarès, résultats, widget, PDF) et
    // cascade de suppression d'une inscription.
    index("products_registration_id_idx").on(table.registrationId),
    index("products_label_id_idx").on(table.labelId),
    check("products_status_check", sql`${table.status} in ('pending', 'received', 'rating', 'rated')`),
  ]
);

/**
 * Products relations for Drizzle query builder
 */
export const productsRelations = relations(products, ({ one, many }) => ({
  registration: one(registrations, {
    fields: [products.registrationId],
    references: [registrations.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  label: one(cupLabels, {
    fields: [products.labelId],
    references: [cupLabels.id],
  }),
  ratings: many(productRatings),
  labAnalysis: one(labAnalyses, {
    fields: [products.id],
    references: [labAnalyses.productId],
  }),
}));

// Forward declaration - imported from ratings.ts for relation
import { productRatings } from "./ratings";
// Forward declaration - imported from lab-analyses.ts for relation
import { labAnalyses } from "./lab-analyses";

// Type exports for use in other parts of the application
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
