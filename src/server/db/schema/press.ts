import { pgTable, text, timestamp, index, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";

/**
 * Press release status type
 */
export type PressReleaseStatus = "draft" | "published";

/**
 * Press releases table
 * Story 12.x: Press releases for portal
 */
export const pressReleases = pgTable(
  "press_releases",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Content
    title: text("title").notNull(),
    excerpt: text("excerpt"), // Short description
    coverImageUrl: text("cover_image_url"), // Cover image URL
    pdfUrl: text("pdf_url"), // PDF file URL

    // Publishing
    status: text("status").$type<PressReleaseStatus>().notNull().default("draft"),
    publishedAt: timestamp("published_at"),

    // Ordering
    displayOrder: integer("display_order").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_press_releases_status").on(table.status),
  ]
);

/**
 * Press releases relations
 */
export const pressReleasesRelations = relations(pressReleases, ({ one }) => ({
  author: one(users, {
    fields: [pressReleases.authorId],
    references: [users.id],
  }),
}));

/**
 * Gallery images table
 * Story 12.x: Photo gallery for press page
 */
export const galleryImages = pgTable(
  "gallery_images",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Image data
    title: text("title").notNull(),
    alt: text("alt"), // Alt text for accessibility
    imageUrl: text("image_url").notNull(), // Full resolution image
    thumbnailUrl: text("thumbnail_url"), // Thumbnail version

    // Metadata
    width: integer("width"),
    height: integer("height"),
    fileSize: integer("file_size"), // In bytes

    // Ordering
    displayOrder: integer("display_order").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);

/**
 * Gallery images relations
 */
export const galleryImagesRelations = relations(galleryImages, ({ one }) => ({
  uploader: one(users, {
    fields: [galleryImages.uploadedBy],
    references: [users.id],
  }),
}));

/**
 * Press settings table
 * Story 12.x: Press page configuration (media kit URL, contact email, etc.)
 */
export const pressSettings = pgTable(
  "press_settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Media Kit
    mediaKitUrl: text("media_kit_url"), // URL to downloadable media kit (ZIP/PDF)
    mediaKitFileName: text("media_kit_file_name"), // Original file name for display

    // Press Contact
    pressEmail: text("press_email"), // Contact email for press inquiries
    pressPhone: text("press_phone"), // Optional phone number

    // Page Settings
    showPressReleases: text("show_press_releases").notNull().default("true"),
    showGallery: text("show_gallery").notNull().default("true"),
    showMediaKit: text("show_media_kit").notNull().default("true"),
    showContact: text("show_contact").notNull().default("true"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);

// Type exports
export type PressRelease = typeof pressReleases.$inferSelect;
export type NewPressRelease = typeof pressReleases.$inferInsert;

export type GalleryImage = typeof galleryImages.$inferSelect;
export type NewGalleryImage = typeof galleryImages.$inferInsert;

export type PressSettings = typeof pressSettings.$inferSelect;
export type NewPressSettings = typeof pressSettings.$inferInsert;
