import { pgTable, text, timestamp, index, boolean, pgEnum, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { generateId } from "./id";
import { users } from "./auth";

/**
 * Contact message status
 */
export const contactMessageStatusEnum = pgEnum("contact_message_status", [
  "unread",
  "read",
  "replied",
  "archived",
]);

export type ContactMessageStatus = "unread" | "read" | "replied" | "archived";

/**
 * Contact message subject categories
 */
export const contactSubjectEnum = [
  "general",
  "registration",
  "results",
  "sponsorship",
  "press",
  "technical",
  "other",
] as const;

export type ContactSubject = (typeof contactSubjectEnum)[number];

/**
 * Contact messages table - Story 12.19
 * Stores contact form submissions from portal visitors
 */
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),

    // Sender info
    senderName: text("sender_name").notNull(),
    senderEmail: text("sender_email").notNull(),
    subject: text("subject").$type<ContactSubject>().notNull(),
    message: text("message").notNull(),

    // Status
    status: contactMessageStatusEnum("status").notNull().default("unread"),
    isStarred: boolean("is_starred").notNull().default(false),

    // Response tracking
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    // `set null` : la suppression d'un organisateur ne doit pas emporter
    // l'historique des messages qu'il a traités.
    repliedBy: text("replied_by").references(() => users.id, { onDelete: "set null" }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_contact_messages_status").on(table.status),
    index("idx_contact_messages_created").on(table.createdAt),
    check("contact_messages_subject_check", sql`${table.subject} in ('general', 'registration', 'results', 'sponsorship', 'press', 'technical', 'other')`),
  ]
);

// Type exports
export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
