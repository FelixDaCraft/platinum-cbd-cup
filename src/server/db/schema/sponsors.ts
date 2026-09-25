import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, jsonb, integer, index, check } from "drizzle-orm/pg-core";
import { cups } from "./cups";

/**
 * Social links structure for sponsors
 */
export interface SponsorSocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
}

/**
 * Testimonial structure for sponsors
 */
export interface SponsorTestimonial {
  id: string;
  text: string;
  authorName: string;
  authorRole?: string;
}

/**
 * Sponsors table - Reusable sponsor entities for cups
 * Sponsors can be associated with multiple cups
 */
export const sponsors = pgTable("sponsors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  logo: text("logo"), // URL to logo image
  description: text("description"),
  website: text("website"),
  socialLinks: jsonb("social_links").$type<SponsorSocialLinks>().default({}),
  gallery: jsonb("gallery").$type<string[]>().default([]), // Array of image URLs
  testimonials: jsonb("testimonials").$type<SponsorTestimonial[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sponsorsRelations = relations(sponsors, ({ many }) => ({
  cupSponsors: many(cupSponsors),
}));

/**
 * Sponsor tier levels for cup associations
 */
export const sponsorTierEnum = ["bronze", "silver", "gold", "platinum"] as const;
export type SponsorTier = (typeof sponsorTierEnum)[number];

/**
 * Cup sponsors junction table - Associates sponsors with cups
 * Includes tier level and display order
 */
export const cupSponsors = pgTable(
  "cup_sponsors",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    cupId: text("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "cascade" }),
    sponsorId: text("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    tier: text("tier").$type<SponsorTier>().notNull().default("bronze"),
    // Entier, et non texte : en `text` le tri est lexicographique et le 10e
    // sponsor s'affichait avant le 2e sur la page publique.
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // La page publique et l'admin listent les sponsors d'une cup.
    index("cup_sponsors_cup_id_idx").on(table.cupId),
    index("cup_sponsors_sponsor_id_idx").on(table.sponsorId),
    check("cup_sponsors_tier_check", sql`${table.tier} in ('bronze', 'silver', 'gold', 'platinum')`),
  ]
);

export const cupSponsorsRelations = relations(cupSponsors, ({ one }) => ({
  sponsor: one(sponsors, {
    fields: [cupSponsors.sponsorId],
    references: [sponsors.id],
  }),
  cup: one(cups, {
    fields: [cupSponsors.cupId],
    references: [cups.id],
  }),
}));

// Type exports
export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;
export type CupSponsor = typeof cupSponsors.$inferSelect;
