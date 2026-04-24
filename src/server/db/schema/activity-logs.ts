import { pgTable, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";

/**
 * Activity log action types
 */
export const activityActionEnum = pgEnum("activity_action", [
  // Auth
  "user_login",
  "user_logout",
  "user_signup",
  "password_reset",
  "email_change",
  // Admin actions
  "admin_create_organizer",
  "admin_suspend_organization",
  "admin_reactivate_organization",
  "admin_toggle_admin",
  "admin_update_plan_config",
  // Organization actions
  "organization_created",
  "organization_updated",
  // Subscription actions
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  // Cup actions
  "cup_created",
  "cup_updated",
  "cup_published",
  "cup_completed",
  "cup_deleted",
  // Registration actions
  "registration_created",
  "registration_confirmed",
  "registration_cancelled",
  // Product actions
  "product_created",
  "product_updated",
  "product_received",
  // Rating actions
  "rating_submitted",
  "results_published",
  "results_sent",
  // Jury actions
  "jury_invited",
  "jury_joined",
  "jury_removed",
  // Other
  "other",
]);

/**
 * Activity logs table for audit trail
 */
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    // Who performed the action (can be null for system actions)
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    // Action type
    action: activityActionEnum("action").notNull(),
    // Description of the action
    description: text("description").notNull(),
    // Additional metadata as JSON
    metadata: text("metadata"), // JSON string for additional data
    // IP address of the request
    ipAddress: text("ip_address"),
    // User agent
    userAgent: text("user_agent"),
    // Timestamp
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("activity_logs_user_id_idx").on(table.userId),
    index("activity_logs_action_idx").on(table.action),
    index("activity_logs_created_at_idx").on(table.createdAt),
  ]
);

/**
 * Activity logs relations for Drizzle query builder
 */
export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

// Type exports
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type ActivityAction = (typeof activityActionEnum.enumValues)[number];
