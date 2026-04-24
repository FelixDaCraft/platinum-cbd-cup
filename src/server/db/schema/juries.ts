import { pgTable, text, timestamp, unique, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cups } from "./cups";
import { users } from "./auth";
import { categories } from "./categories";

/**
 * Jury type enum values
 * - pro: Professional jury invited by organizer
 * - public: Public jury who purchased a QR code pack
 */
export const juryTypeEnum = ["pro", "public"] as const;
export type JuryType = (typeof juryTypeEnum)[number];

/**
 * Jury Profiles table - Jury accounts linked to users
 *
 * Juries are created via:
 *   - Invitation from organizer (pro jury)
 *   - QR code claim from public pack (public jury)
 */
export const juryProfiles = pgTable(
  "jury_profiles",
  {
    id: text("id").primaryKey(), // nanoid generated
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    juryType: text("jury_type")
      .notNull()
      .$type<JuryType>()
      .default("pro"),
    // Profile information
    expertise: text("expertise"), // Domain expertise (e.g., "Sommelier", "Cannabis expert")
    bio: text("bio"), // Short biography
    displayName: text("display_name"), // Public name for results pages (with consent)
    showOnPublicResults: boolean("show_on_public_results")
      .notNull()
      .default(false), // Consent to show name on public results
    // Notification preferences
    notifyOnInvitation: boolean("notify_on_invitation")
      .notNull()
      .default(true),
    notifyOnAssignment: boolean("notify_on_assignment")
      .notNull()
      .default(true),
    notifyOnReminder: boolean("notify_on_reminder")
      .notNull()
      .default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // A user can only have ONE jury profile
    unique("jury_profile_user_unique").on(table.userId),
  ]
);

/**
 * Jury Profiles relations for Drizzle query builder
 */
export const juryProfilesRelations = relations(juryProfiles, ({ one }) => ({
  user: one(users, {
    fields: [juryProfiles.userId],
    references: [users.id],
  }),
}));

// Jury Profile type exports
export type JuryProfile = typeof juryProfiles.$inferSelect;
export type NewJuryProfile = typeof juryProfiles.$inferInsert;

/**
 * Jury invitation status enum values
 * - pending: Invitation envoyee, en attente de reponse
 * - accepted: Invitation acceptee, jury actif
 * - declined: Invitation refusee
 * - expired: Invitation expiree sans reponse
 */
export const juryInvitationStatusEnum = [
  "pending",
  "accepted",
  "declined",
  "expired",
] as const;
export type JuryInvitationStatus = (typeof juryInvitationStatusEnum)[number];

/**
 * Jury Invitations table
 * Tracks invitations sent to potential juries
 * An invitation can be linked to an existing user or just an email
 */
export const juryInvitations = pgTable(
  "jury_invitations",
  {
    id: text("id").primaryKey(), // nanoid generated
    cupId: text("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "cascade" }),
    email: text("email").notNull(), // Email of the invited jury
    firstName: text("first_name"), // Optional, from CSV import
    lastName: text("last_name"), // Optional, from CSV import
    customMessage: text("custom_message"), // Optional personalized message
    token: text("token").notNull().unique(), // Unique token for invitation link
    status: text("status")
      .notNull()
      .$type<JuryInvitationStatus>()
      .default("pending"),
    // If the user already exists in the system
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    // Tracking
    sentAt: timestamp("sent_at"),
    lastReminderAt: timestamp("last_reminder_at"),
    reminderCount: text("reminder_count").default("0"),
    acceptedAt: timestamp("accepted_at"),
    declinedAt: timestamp("declined_at"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // A user can only be invited once per cup (by email)
    unique("jury_invitation_cup_email_unique").on(table.cupId, table.email),
  ]
);

/**
 * Cup Juries table
 * Links accepted juries to cups
 * Created when a jury accepts an invitation or claims a public token
 * References the organization-scoped juryProfile
 */
export const cupJuries = pgTable(
  "cup_juries",
  {
    id: text("id").primaryKey(), // nanoid generated
    cupId: text("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Link to the organization-scoped jury profile
    juryProfileId: text("jury_profile_id")
      .references(() => juryProfiles.id, { onDelete: "set null" }),
    invitationId: text("invitation_id").references(() => juryInvitations.id, {
      onDelete: "set null",
    }),
    // Jury can be active or inactive (removed by organizer)
    isActive: boolean("is_active").notNull().default(true),
    // Notification preferences (copied from profile, can be overridden per cup)
    notifyOnAssignment: boolean("notify_on_assignment").notNull().default(true),
    notifyOnReminder: boolean("notify_on_reminder").notNull().default(true),
    // Reminder tracking
    lastReminderAt: timestamp("last_reminder_at"),
    reminderCount: text("reminder_count").default("0"),
    // Rating sheet tracking
    ratingSheetSentAt: timestamp("rating_sheet_sent_at"),
    // Samples reception confirmation
    samplesReceivedAt: timestamp("samples_received_at"),
    // Tracking
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // A user can only be a jury once per cup
    unique("cup_jury_cup_user_unique").on(table.cupId, table.userId),
  ]
);

/**
 * Jury Category Assignments table
 * Links juries to specific categories they can rate
 */
export const juryCategoryAssignments = pgTable(
  "jury_category_assignments",
  {
    id: text("id").primaryKey(), // nanoid generated
    cupJuryId: text("cup_jury_id")
      .notNull()
      .references(() => cupJuries.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
    assignedBy: text("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // A jury can only be assigned to a category once
    unique("jury_category_assignment_unique").on(table.cupJuryId, table.categoryId),
  ]
);

// Relations

export const juryInvitationsRelations = relations(juryInvitations, ({ one }) => ({
  cup: one(cups, {
    fields: [juryInvitations.cupId],
    references: [cups.id],
  }),
  user: one(users, {
    fields: [juryInvitations.userId],
    references: [users.id],
  }),
}));

export const cupJuriesRelations = relations(cupJuries, ({ one, many }) => ({
  cup: one(cups, {
    fields: [cupJuries.cupId],
    references: [cups.id],
  }),
  user: one(users, {
    fields: [cupJuries.userId],
    references: [users.id],
  }),
  juryProfile: one(juryProfiles, {
    fields: [cupJuries.juryProfileId],
    references: [juryProfiles.id],
  }),
  invitation: one(juryInvitations, {
    fields: [cupJuries.invitationId],
    references: [juryInvitations.id],
  }),
  categoryAssignments: many(juryCategoryAssignments),
}));

export const juryCategoryAssignmentsRelations = relations(
  juryCategoryAssignments,
  ({ one }) => ({
    cupJury: one(cupJuries, {
      fields: [juryCategoryAssignments.cupJuryId],
      references: [cupJuries.id],
    }),
    category: one(categories, {
      fields: [juryCategoryAssignments.categoryId],
      references: [categories.id],
    }),
    assignedByUser: one(users, {
      fields: [juryCategoryAssignments.assignedBy],
      references: [users.id],
    }),
  })
);

/**
 * Public Jury Tokens table - Story 7.9
 * Tokens distributed with physical packs for public jury participation
 * Can be claimed by any user (creates cupJury entry)
 */
export const publicJuryTokenStatusEnum = [
  "available",  // Not yet claimed
  "claimed",    // Claimed by a user
  "expired",    // Past expiration date without being claimed
] as const;
export type PublicJuryTokenStatus = (typeof publicJuryTokenStatusEnum)[number];

export const publicJuryTokens = pgTable(
  "public_jury_tokens",
  {
    id: text("id").primaryKey(), // nanoid generated
    cupId: text("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(), // Unique token for QR code
    status: text("status")
      .notNull()
      .$type<PublicJuryTokenStatus>()
      .default("available"),
    // When claimed, link to the user and cupJury
    claimedByUserId: text("claimed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cupJuryId: text("cup_jury_id").references(() => cupJuries.id, {
      onDelete: "set null",
    }),
    claimedAt: timestamp("claimed_at"),
    // Metadata
    batchId: text("batch_id"), // To group tokens generated together
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);

export const publicJuryTokensRelations = relations(publicJuryTokens, ({ one }) => ({
  cup: one(cups, {
    fields: [publicJuryTokens.cupId],
    references: [cups.id],
  }),
  category: one(categories, {
    fields: [publicJuryTokens.categoryId],
    references: [categories.id],
  }),
  claimedBy: one(users, {
    fields: [publicJuryTokens.claimedByUserId],
    references: [users.id],
  }),
  cupJury: one(cupJuries, {
    fields: [publicJuryTokens.cupJuryId],
    references: [cupJuries.id],
  }),
}));

// Type exports
export type JuryInvitation = typeof juryInvitations.$inferSelect;
export type NewJuryInvitation = typeof juryInvitations.$inferInsert;
export type CupJury = typeof cupJuries.$inferSelect;
export type NewCupJury = typeof cupJuries.$inferInsert;
export type JuryCategoryAssignment = typeof juryCategoryAssignments.$inferSelect;
export type NewJuryCategoryAssignment = typeof juryCategoryAssignments.$inferInsert;
export type PublicJuryToken = typeof publicJuryTokens.$inferSelect;
export type NewPublicJuryToken = typeof publicJuryTokens.$inferInsert;
