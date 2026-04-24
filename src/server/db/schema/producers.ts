import { pgTable, text, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { registrations } from "./registrations";

/**
 * Producers table - Producer accounts linked to users
 */
export const producers = pgTable(
  "producers",
  {
    id: text("id").primaryKey(), // nanoid generated
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    brandName: text("brand_name").notNull(),
    logo: text("logo"), // URL to Cloudflare R2
    siret: text("siret"), // French company ID (14 digits), optional
    website: text("website"), // Optional website URL
    phone: text("phone"), // Contact phone number, optional
    address: text("address"), // Business address, optional
    // Notification preferences
    notifyOnProductStatusChange: boolean("notify_on_product_status_change")
      .notNull()
      .default(true),
    notifyOnCupUpdates: boolean("notify_on_cup_updates")
      .notNull()
      .default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // A user can only have ONE producer profile
    unique("producer_user_unique").on(table.userId),
  ]
);

/**
 * Producers relations for Drizzle query builder
 */
export const producersRelations = relations(producers, ({ one, many }) => ({
  user: one(users, {
    fields: [producers.userId],
    references: [users.id],
  }),
  registrations: many(registrations),
}));

// Type exports for use in other parts of the application
export type Producer = typeof producers.$inferSelect;
export type NewProducer = typeof producers.$inferInsert;
