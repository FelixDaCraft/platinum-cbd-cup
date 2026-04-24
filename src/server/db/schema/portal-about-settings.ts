import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Hero section style options
 */
export const heroStyleEnum = ["banner", "minimal", "none"] as const;
export type HeroStyle = (typeof heroStyleEnum)[number];

/**
 * Mission display style options
 */
export const missionStyleEnum = ["quote", "card", "simple"] as const;
export type MissionStyle = (typeof missionStyleEnum)[number];

/**
 * Values display style options
 */
export const valuesDisplayEnum = ["cards", "list", "grid"] as const;
export type ValuesDisplay = (typeof valuesDisplayEnum)[number];

/**
 * Team card size options
 */
export const teamCardSizeEnum = ["compact", "large"] as const;
export type TeamCardSize = (typeof teamCardSizeEnum)[number];

/**
 * Gallery columns options
 */
export const galleryColumnsEnum = ["2", "3", "4"] as const;
export type GalleryColumns = (typeof galleryColumnsEnum)[number];

/**
 * Section background style options
 */
export const sectionStyleEnum = ["alternating", "uniform"] as const;
export type SectionStyle = (typeof sectionStyleEnum)[number];

/**
 * Portal about page settings table
 * Stores UX/display preferences for the About page
 */
export const portalAboutSettings = pgTable(
  "portal_about_settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Hero section configuration
    heroStyle: text("hero_style").$type<HeroStyle>().default("banner"),
    heroTagline: text("hero_tagline"), // Optional tagline for the hero

    // Mission section configuration
    missionStyle: text("mission_style").$type<MissionStyle>().default("quote"),

    // Values section configuration
    valuesDisplay: text("values_display").$type<ValuesDisplay>().default("cards"),

    // Team section configuration
    teamCardSize: text("team_card_size").$type<TeamCardSize>().default("large"),
    showTeamSocialLinks: boolean("show_team_social_links").default(true),

    // Gallery configuration
    galleryColumns: text("gallery_columns").$type<GalleryColumns>().default("3"),
    enableGalleryLightbox: boolean("enable_gallery_lightbox").default(true),

    // Section styling
    sectionStyle: text("section_style").$type<SectionStyle>().default("alternating"),

    // Animations
    enableAnimations: boolean("enable_animations").default(true),

    // Stats section (optional)
    showStats: boolean("show_stats").default(false),
    statsYearFounded: text("stats_year_founded"),
    statsCupsOrganized: text("stats_cups_organized"),
    statsJudgesCount: text("stats_judges_count"),
    statsCustomLabel1: text("stats_custom_label_1"),
    statsCustomValue1: text("stats_custom_value_1"),
    statsCustomLabel2: text("stats_custom_label_2"),
    statsCustomValue2: text("stats_custom_value_2"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);

// Type exports
export type PortalAboutSettings = typeof portalAboutSettings.$inferSelect;
export type NewPortalAboutSettings = typeof portalAboutSettings.$inferInsert;
