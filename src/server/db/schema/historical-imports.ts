import { pgTable, text, timestamp, integer, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { generateId } from "./id";
import { producers } from "./producers";
import { users } from "./auth";

/**
 * Medal type enum values for historical results
 */
export const historicalMedalEnum = ["gold", "silver", "bronze", "mention", "none"] as const;
export type HistoricalMedal = (typeof historicalMedalEnum)[number];

/**
 * Historical Cups table - Imported past editions
 * Éditions antérieures à la plateforme, importées pour l'affichage du palmarès.
 */
export const historicalCups = pgTable("historical_cups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  name: text("name").notNull(),
  year: integer("year").notNull(), // e.g., 2022
  edition: text("edition"), // e.g., "5ème édition" (optional)
  eventDate: timestamp("event_date", { withTimezone: true }), // Approximate date of the event
  description: text("description"),
  // Import metadata
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  // `set null` : les archives survivent à la suppression du compte qui les a
  // importées.
  importedBy: text("imported_by").references(() => users.id, { onDelete: "set null" }),
  productsCount: integer("products_count").default(0),
  producersCount: integer("producers_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Historical Producers table - Producers from imported data
 * May be linked to real producer accounts when they register
 */
export const historicalProducers = pgTable("historical_producers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  // Producer info from import (may be partial)
  name: text("name").notNull(), // Company or brand name
  email: text("email"), // Optional - used for matching
  phone: text("phone"), // Optional
  // Linking to real producer account
  linkedProducerId: text("linked_producer_id")
    .references(() => producers.id, { onDelete: "set null" }),
  linkedAt: timestamp("linked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Historical Results table - Products and their results from imported cups
 */
export const historicalResults = pgTable(
  "historical_results",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    historicalCupId: text("historical_cup_id")
      .notNull()
      .references(() => historicalCups.id, { onDelete: "cascade" }),
    historicalProducerId: text("historical_producer_id")
      .notNull()
      .references(() => historicalProducers.id, { onDelete: "cascade" }),
    // Product info
    productName: text("product_name").notNull(),
    category: text("category"), // Category name (text, not linked)
    // Result info - at least one should be provided
    medal: text("medal").$type<HistoricalMedal>().default("none"),
    rank: integer("rank"), // e.g., 1, 2, 3
    score: integer("score"), // Optional numeric score (0-100)
    // Additional info
    notes: text("notes"), // Any additional notes about this result
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Le palmarès public branche sur la médaille : une valeur inconnue la rend
    // invisible sans erreur.
    check("historical_results_medal_check", sql`${table.medal} in ('gold', 'silver', 'bronze', 'mention', 'none')`),
  ]
);

/**
 * Relations for historical tables
 */
export const historicalCupsRelations = relations(historicalCups, ({ many }) => ({
  results: many(historicalResults),
}));

export const historicalProducersRelations = relations(historicalProducers, ({ one, many }) => ({
  linkedProducer: one(producers, {
    fields: [historicalProducers.linkedProducerId],
    references: [producers.id],
  }),
  results: many(historicalResults),
}));

export const historicalResultsRelations = relations(historicalResults, ({ one }) => ({
  historicalCup: one(historicalCups, {
    fields: [historicalResults.historicalCupId],
    references: [historicalCups.id],
  }),
  historicalProducer: one(historicalProducers, {
    fields: [historicalResults.historicalProducerId],
    references: [historicalProducers.id],
  }),
}));

// Type exports
export type HistoricalCup = typeof historicalCups.$inferSelect;
export type NewHistoricalCup = typeof historicalCups.$inferInsert;
export type HistoricalProducer = typeof historicalProducers.$inferSelect;
export type NewHistoricalProducer = typeof historicalProducers.$inferInsert;
export type HistoricalResult = typeof historicalResults.$inferSelect;
export type NewHistoricalResult = typeof historicalResults.$inferInsert;
