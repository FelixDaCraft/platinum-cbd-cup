import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Team member structure
 */
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  photo: string | null;
  bio: string | null;
}

/**
 * Organization about page content
 * Stores customizable "À Propos" content for portal display
 */
export const organizationAbout = pgTable("organization_about", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Content sections
  history: text("history"),
  mission: text("mission"),
  values: text("values"),

  // Gallery images (array of URLs)
  galleryImages: jsonb("gallery_images").$type<string[]>().default([]),

  // Team members
  teamMembers: jsonb("team_members").$type<TeamMember[]>().default([]),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrganizationAbout = typeof organizationAbout.$inferSelect;
export type NewOrganizationAbout = typeof organizationAbout.$inferInsert;
