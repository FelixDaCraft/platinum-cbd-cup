import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, json } from "drizzle-orm/pg-core";

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
  socialLinks: json("social_links").$type<SponsorSocialLinks>().default({}),
  gallery: json("gallery").$type<string[]>().default([]), // Array of image URLs
  testimonials: json("testimonials").$type<SponsorTestimonial[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
export const cupSponsors = pgTable("cup_sponsors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  cupId: text("cup_id").notNull(),
  sponsorId: text("sponsor_id")
    .notNull()
    .references(() => sponsors.id, { onDelete: "cascade" }),
  tier: text("tier").$type<SponsorTier>().notNull().default("bronze"),
  displayOrder: text("display_order").notNull().default("0"), // String for sorting
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cupSponsorsRelations = relations(cupSponsors, ({ one }) => ({
  sponsor: one(sponsors, {
    fields: [cupSponsors.sponsorId],
    references: [sponsors.id],
  }),
}));

// Type exports
export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;
export type CupSponsor = typeof cupSponsors.$inferSelect;
