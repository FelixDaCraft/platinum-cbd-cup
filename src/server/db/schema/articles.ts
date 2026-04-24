import { pgTable, text, timestamp, json, unique, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { sponsors } from "./sponsors";

/**
 * Article status type
 */
export type ArticleStatus = "draft" | "published";

/**
 * Predefined category colors following UX spec
 * Categories are customizable but we provide default color mapping
 */
export const ARTICLE_CATEGORY_COLORS: Record<string, string> = {
  "RÉSULTATS": "#22C55E",    // green
  "RÉSULTAT": "#22C55E",
  "RESULTS": "#22C55E",
  "ÉVÉNEMENT": "#3B82F6",    // blue
  "EVENEMENT": "#3B82F6",
  "EVENT": "#3B82F6",
  "INTERVIEW": "#A855F7",    // purple
  "ACTUALITÉ": "#F59E0B",    // amber
  "ACTUALITE": "#F59E0B",
  "NEWS": "#F59E0B",
  "PARTENAIRE": "#F97316",   // orange
  "SPONSOR": "#F97316",
  "CONSEILS": "#EF4444",     // red
  "TIPS": "#EF4444",
  "GUIDE": "#EF4444",
};

/**
 * Get color for a category (case-insensitive)
 */
export function getCategoryColor(category: string | null): string | null {
  if (!category) return null;
  const normalized = category.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ARTICLE_CATEGORY_COLORS[normalized] ?? ARTICLE_CATEGORY_COLORS[category.toUpperCase()] ?? null;
}

/**
 * Articles table
 * Story 11.15: Blog articles for portal
 * Story 11.16: Added isFeatured and categoryColor for UX spec compliance
 */
export const articles = pgTable(
  "articles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sponsorId: text("sponsor_id").references(() => sponsors.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    content: json("content").$type<Record<string, unknown>>().notNull(), // TipTap JSON content
    coverImage: text("cover_image"),
    category: text("category"),
    categoryColor: text("category_color"), // Custom color override for category badge
    tags: json("tags").$type<string[]>().default([]),
    isFeatured: boolean("is_featured").notNull().default(false), // Featured article (à la une)
    status: text("status").$type<ArticleStatus>().notNull().default("draft"),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Unique slug
    unique("articles_slug_unique").on(table.slug),
  ]
);

/**
 * Articles relations
 */
export const articlesRelations = relations(articles, ({ one }) => ({
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
  sponsor: one(sponsors, {
    fields: [articles.sponsorId],
    references: [sponsors.id],
  }),
}));

// Type exports
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
