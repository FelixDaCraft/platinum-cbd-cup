import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, jsonb, boolean, index, check } from "drizzle-orm/pg-core";
import { cupSponsors } from "./sponsors";

/**
 * Template style presets for RS posts
 */
export const rsTemplateStyleEnum = [
  "classic",
  "modern",
  "minimal",
  "vibrant",
  "elegant",
] as const;
export type RSTemplateStyle = (typeof rsTemplateStyleEnum)[number];

/**
 * Color configuration for RS templates
 */
export interface RSTemplateColors {
  background: string;
  text: string;
  accent: string;
  overlay?: string;
}

/**
 * RS Templates table - Reusable templates for social media posts
 * Used for generating sponsor announcement images
 */
export const rsTemplates = pgTable(
  "rs_templates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    style: text("style").$type<RSTemplateStyle>().notNull().default("classic"),
    textTemplate: text("text_template").notNull().default(
      "Bienvenue \u00e0 {sponsor.name} comme sponsor {sponsor.level} de {cup.name} !"
    ),
    captionTemplate: text("caption_template").default(
      "Nous sommes ravis d'accueillir {sponsor.name} comme partenaire {sponsor.level} de {cup.name} ! Merci pour votre soutien. #sponsor #{cup.hashtag}"
    ),
    colors: jsonb("colors").$type<RSTemplateColors>().default({
      background: "#1a1a2e",
      text: "#ffffff",
      accent: "#f59e0b",
    }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Même garde-fou que sur les autres états : le rendu du visuel branche sur
    // le style et tomberait sur une valeur inconnue.
    check("rs_templates_style_check", sql`${table.style} in ('classic', 'modern', 'minimal', 'vibrant', 'elegant')`),
  ]
);

/**
 * Generated RS Posts table - Tracks generated social media posts
 * Stores references to generated images for sponsors
 */
export const rsGeneratedPosts = pgTable(
  "rs_generated_posts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    // Cascade : retirer un sponsor d'une cup doit emporter les visuels générés
    // pour lui, qui n'ont plus de sens seuls.
    cupSponsorId: text("cup_sponsor_id")
      .notNull()
      .references(() => cupSponsors.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => rsTemplates.id, { onDelete: "set null" }),
    format: text("format").$type<"instagram" | "twitter">().notNull().default("instagram"),
    imageUrl: text("image_url"), // URL to generated image (if stored)
    caption: text("caption"), // Generated caption text
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("rs_generated_posts_cup_sponsor_id_idx").on(table.cupSponsorId),
    index("rs_generated_posts_template_id_idx").on(table.templateId),
    check("rs_generated_posts_format_check", sql`${table.format} in ('instagram', 'twitter')`),
  ]
);

export const rsGeneratedPostsRelations = relations(rsGeneratedPosts, ({ one }) => ({
  template: one(rsTemplates, {
    fields: [rsGeneratedPosts.templateId],
    references: [rsTemplates.id],
  }),
  cupSponsor: one(cupSponsors, {
    fields: [rsGeneratedPosts.cupSponsorId],
    references: [cupSponsors.id],
  }),
}));

// Type exports
export type RSTemplate = typeof rsTemplates.$inferSelect;
export type NewRSTemplate = typeof rsTemplates.$inferInsert;
export type RSGeneratedPost = typeof rsGeneratedPosts.$inferSelect;
