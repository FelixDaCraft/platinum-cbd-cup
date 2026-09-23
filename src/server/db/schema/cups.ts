import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { categories } from "./categories";
import { cupLabels } from "./cup-labels";
import { registrations } from "./registrations";
import { users } from "./auth";

/**
 * Payment provider enum values
 */
export const paymentProviderEnum = ["viva_wallet"] as const;
export type PaymentProvider = (typeof paymentProviderEnum)[number];

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
export const cups = pgTable("cups", {
  id: text("id").primaryKey(), // nanoid generated
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
  registrationOpenAt: timestamp("registration_open_at"),  // When registrations open
  registrationCloseAt: timestamp("registration_close_at"), // When registrations close
  ratingStartAt: timestamp("rating_start_at"),            // When rating phase begins
  ratingEndAt: timestamp("rating_end_at"),                // When rating phase ends
  // Manual lock timestamp - Story 7.11
  // When set, all ratings are locked regardless of ratingEndAt
  ratingsLockedAt: timestamp("ratings_locked_at"),
  ratingsLockedBy: text("ratings_locked_by").references(() => users.id, { onDelete: "set null" }),
  // Payment configuration
  paymentProvider: text("payment_provider").$type<PaymentProvider>(), // null = not configured
  paymentConfigEncrypted: text("payment_config_encrypted"), // Encrypted JSON with API keys
  paymentConfiguredAt: timestamp("payment_configured_at"), // When payment was configured
  // Anonymization configuration for product codes
  // Prefix used for anonymous codes (A-Z), format: #[PREFIX][NUMBER] e.g., #A127
  anonymizationPrefix: text("anonymization_prefix").default("A"),
  // PDF customization - Story 8.3
  pdfLogoUrl: text("pdf_logo_url"), // URL to logo for PDF syntheses
  pdfIntroText: text("pdf_intro_text"), // Custom intro text for PDF syntheses
  // Public page customization - Story 9.1
  bannerUrl: text("banner_url"), // URL to banner image for public page
  publicPageDescription: text("public_page_description"), // Extended description for public page
  galleryUrls: text("gallery_urls"), // JSON array of gallery image URLs
  eventDate: timestamp("event_date"), // Main event date shown on public page
  eventLocation: text("event_location"), // Location/venue for the event
  contactEmail: text("contact_email"), // Contact email shown on public page
  websiteUrl: text("website_url"), // External website URL
  // Results publication - Story 9.4
  resultsPublishedAt: timestamp("results_published_at"), // When results were made public
  resultsVisibility: text("results_visibility").$type<"podium" | "labels" | "labels_and_podium" | "all">().default("labels"), // What to show publicly
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
