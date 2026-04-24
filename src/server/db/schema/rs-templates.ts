import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, json, boolean } from "drizzle-orm/pg-core";

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
export const rsTemplates = pgTable("rs_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  style: text("style").$type<RSTemplateStyle>().notNull().default("classic"),
  textTemplate: text("text_template").notNull().default(
    "Bienvenue \u00e0 {sponsor.name} comme sponsor {sponsor.level} de {cup.name} !"
  ),
  captionTemplate: text("caption_template").default(
    "Nous sommes ravis d'accueillir {sponsor.name} comme partenaire {sponsor.level} de {cup.name} ! Merci pour votre soutien. #sponsor #{cup.hashtag}"
  ),
  colors: json("colors").$type<RSTemplateColors>().default({
    background: "#1a1a2e",
    text: "#ffffff",
    accent: "#f59e0b",
  }),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Generated RS Posts table - Tracks generated social media posts
 * Stores references to generated images for sponsors
 */
export const rsGeneratedPosts = pgTable("rs_generated_posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  cupSponsorId: text("cup_sponsor_id").notNull(),
  templateId: text("template_id").references(() => rsTemplates.id, { onDelete: "set null" }),
  format: text("format").$type<"instagram" | "twitter">().notNull().default("instagram"),
  imageUrl: text("image_url"), // URL to generated image (if stored)
  caption: text("caption"), // Generated caption text
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rsGeneratedPostsRelations = relations(rsGeneratedPosts, ({ one }) => ({
  template: one(rsTemplates, {
    fields: [rsGeneratedPosts.templateId],
    references: [rsTemplates.id],
  }),
}));

// Type exports
export type RSTemplate = typeof rsTemplates.$inferSelect;
export type NewRSTemplate = typeof rsTemplates.$inferInsert;
export type RSGeneratedPost = typeof rsGeneratedPosts.$inferSelect;
