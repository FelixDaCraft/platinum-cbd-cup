import { pgTable, text, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { generateId } from "./id";
import { users } from "./auth";
import { registrations } from "./registrations";

/**
 * Producers table - Producer accounts linked to users
 */
export const producers = pgTable(
  "producers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    brandName: text("brand_name").notNull(),
    logo: text("logo"), // Chemin /uploads/producer-logos/…
    // Photo du producteur ou de son équipe, reprise avec le logo sur les
    // réseaux sociaux de la cup pour annoncer sa participation.
    teamPhoto: text("team_photo"),
    // Consentement à cette reprise : date d'acceptation, null s'il n'a pas été
    // donné ou a été retiré. Aucun visuel ne se dépose sans lui.
    mediaConsentAt: timestamp("media_consent_at", { withTimezone: true }),
    siret: text("siret"), // French company ID (14 digits), optional
    website: text("website"), // Optional website URL
    // Compte Instagram de la marque, sans @ (mentionné sur les publications
    // de la cup qui annoncent sa participation).
    instagram: text("instagram"),
    phone: text("phone"), // Contact phone number, optional
    address: text("address"), // Business address, optional
    // Notification preferences
    notifyOnProductStatusChange: boolean("notify_on_product_status_change")
      .notNull()
      .default(true),
    notifyOnCupUpdates: boolean("notify_on_cup_updates")
      .notNull()
      .default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
