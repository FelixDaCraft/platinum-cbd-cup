import { pgTable, text, timestamp, index, boolean, pgEnum } from "drizzle-orm/pg-core";

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
    id: text("id").primaryKey(),

    // Sender info
    senderName: text("sender_name").notNull(),
    senderEmail: text("sender_email").notNull(),
    subject: text("subject").$type<ContactSubject>().notNull(),
    message: text("message").notNull(),

    // Status
    status: contactMessageStatusEnum("status").notNull().default("unread"),
    isStarred: boolean("is_starred").notNull().default(false),

    // Response tracking
    repliedAt: timestamp("replied_at"),
    repliedBy: text("replied_by"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_contact_messages_status").on(table.status),
    index("idx_contact_messages_created").on(table.createdAt),
  ]
);

// Type exports
export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
