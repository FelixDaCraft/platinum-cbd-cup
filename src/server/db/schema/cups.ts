import { pgTable, text, timestamp, integer, jsonb, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { generateId } from "./id";
import { categories } from "./categories";
import { cupLabels } from "./cup-labels";
import { registrations } from "./registrations";
import { users } from "./auth";

/**
 * Cup type enum values
 * - public: Jurys amateurs, vote public
 * - pro: Jurys professionnels uniquement
 */
export const cupTypeEnum = ["public", "pro"] as const;
export type CupType = (typeof cupTypeEnum)[number];

/**
 * Cup status enum values
 * - draft: En cours de configuration
 * - published: Inscriptions ouvertes
 * - registration_closed: Inscriptions fermées
 * - rating: Phase de notation
 * - completed: Compétition terminée
 */
export const cupStatusEnum = [
  "draft",
  "published",
  "registration_closed",
  "rating",
  "completed",
] as const;
export type CupStatus = (typeof cupStatusEnum)[number];

/**
 * Currency enum values for pricing
 */
export const currencyEnum = ["EUR", "USD", "GBP", "CHF"] as const;
export type Currency = (typeof currencyEnum)[number];

/**
 * Rating scale enum values
 * Defines the notation scale used for all criteria in this cup
 * - 0-5: Notes de 0 à 5 (étoiles)
 * - 0-10: Notes de 0 à 10 (décimal)
 * - 0-20: Notes de 0 à 20 (vingtième) - default
 * - 0-100: Notes de 0 à 100 (pourcentage)
 */
export const ratingScaleEnum = ["0-5", "0-10", "0-20", "0-100"] as const;
export type RatingScale = (typeof ratingScaleEnum)[number];

/**
 * Cups table - Competitions managed by organizers
 */
export const cups = pgTable(
  "cups",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    name: text("name").notNull(),
    type: text("type").notNull().$type<CupType>(), // "public" | "pro"
    description: text("description"),
    status: text("status").notNull().$type<CupStatus>().default("draft"),
    // Pricing fields
    defaultPricePerProduct: integer("default_price_per_product"), // Price in cents, null = free
    currency: text("currency").$type<Currency>().default("EUR"),
    // Rating scale for all criteria in this cup
    ratingScale: text("rating_scale").$type<RatingScale>().notNull().default("0-20"),
    // Phase dates for cup lifecycle management
    // All dates are nullable - organizer can choose manual transitions
    registrationOpenAt: timestamp("registration_open_at", { withTimezone: true }),  // When registrations open
    registrationCloseAt: timestamp("registration_close_at", { withTimezone: true }), // When registrations close
    ratingStartAt: timestamp("rating_start_at", { withTimezone: true }),            // When rating phase begins
    ratingEndAt: timestamp("rating_end_at", { withTimezone: true }),                // When rating phase ends
    // Manual lock timestamp - Story 7.11
    // When set, all ratings are locked regardless of ratingEndAt
    ratingsLockedAt: timestamp("ratings_locked_at", { withTimezone: true }),
    ratingsLockedBy: text("ratings_locked_by").references(() => users.id, { onDelete: "set null" }),
    // Préfixe des codes anonymes (A-Z).
    // ATTENTION : plus aucun code ne le lit. `generateAnonymousCode`
    // (src/server/services/anonymization.service.ts) construit le préfixe à
    // partir des initiales du nom de la catégorie ("Café Filtre" -> CF23).
    // La colonne n'a plus que deux écrivains : la mutation tRPC
    // `cup.updateAnonymizationPrefix` — qu'aucun écran n'appelle, elle n'est
    // atteignable qu'en appel direct — et l'INSERT SQL brut de
    // scripts/historical-import/run.ts.
    // On ne supprime pas la colonne ici : il faut d'abord trancher entre
    // « le service honore le préfixe » et « le réglage disparaît » (colonne +
    // mutation + script dans le même lot), sinon le DROP COLUMN casse l'import
    // historique — et comme c'est du SQL en chaîne, ni tsc ni les tests ne le
    // verraient avant la panne.
    anonymizationPrefix: text("anonymization_prefix").default("A"),
    // PDF customization - Story 8.3
    pdfLogoUrl: text("pdf_logo_url"), // URL to logo for PDF syntheses
    pdfIntroText: text("pdf_intro_text"), // Custom intro text for PDF syntheses
    // Public page customization - Story 9.1
    bannerUrl: text("banner_url"), // URL to banner image for public page
    publicPageDescription: text("public_page_description"), // Extended description for public page
    // Galerie de la page publique. Stockée en `jsonb` comme les autres
    // galeries du schéma (sponsors.gallery, organization_about.gallery_images) :
    // en `text`, le tableau était sérialisé à la main et un contenu invalide
    // (écriture hors application, troncature) ne se voyait qu'au JSON.parse du
    // routeur, qui repliait silencieusement sur une galerie vide. Une fois la
    // migration 0005 appliquée, Postgres refuse la valeur à l'écriture.
    // ATTENTION à l'ordre de déploiement : tant que la colonne est en `text`
    // côté base, Drizzle rend la chaîne brute là où le type annonce
    // `string[]`. Rien ne le lit aujourd'hui (la colonne est NULL partout en
    // production), mais le code et la base ne se rejoignent qu'après 0005.
    galleryUrls: jsonb("gallery_urls").$type<string[]>(),
    eventDate: timestamp("event_date", { withTimezone: true }), // Main event date shown on public page
    eventLocation: text("event_location"), // Location/venue for the event
    contactEmail: text("contact_email"), // Contact email shown on public page
    websiteUrl: text("website_url"), // External website URL
    // Results publication - Story 9.4
    resultsPublishedAt: timestamp("results_published_at", { withTimezone: true }), // When results were made public
    resultsVisibility: text("results_visibility").$type<"podium" | "labels" | "labels_and_podium" | "all">().default("labels"), // What to show publicly
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Garde-fous en base sur les états : les écritures hors tRPC (script,
    // import, SQL manuel) ne doivent pas pouvoir poser une valeur inconnue
    // qui ferait silencieusement échouer les filtres métier.
    check("cups_status_check", sql`${table.status} in ('draft', 'published', 'registration_closed', 'rating', 'completed')`),
    check("cups_type_check", sql`${table.type} in ('public', 'pro')`),
    check("cups_rating_scale_check", sql`${table.ratingScale} in ('0-5', '0-10', '0-20', '0-100')`),
    check("cups_currency_check", sql`${table.currency} in ('EUR', 'USD', 'GBP', 'CHF')`),
    check("cups_results_visibility_check", sql`${table.resultsVisibility} in ('podium', 'labels', 'labels_and_podium', 'all')`),
  ]
);

/**
 * Cups relations for Drizzle query builder
 */
export const cupsRelations = relations(cups, ({ many }) => ({
  categories: many(categories),
  labels: many(cupLabels),
  registrations: many(registrations),
}));

// Type exports for use in other parts of the application
export type Cup = typeof cups.$inferSelect;
export type NewCup = typeof cups.$inferInsert;
