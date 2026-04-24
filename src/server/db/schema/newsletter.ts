import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * Newsletter subscriber status
 */
export type SubscriberStatus = "pending" | "active" | "unsubscribed";

/**
 * Newsletter subscribers table
 * Story 11.17: Newsletter management
 */
export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    name: text("name"),
    status: text("status").$type<SubscriberStatus>().notNull().default("pending"),
    // Confirmation token for double opt-in
    confirmationToken: text("confirmation_token"),
    confirmedAt: timestamp("confirmed_at"),
    // Unsubscribe tracking
    unsubscribedAt: timestamp("unsubscribed_at"),
    unsubscribeToken: text("unsubscribe_token"),
    // Source tracking
    source: text("source").default("portal"), // portal, import, manual
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Unique email
    unique("newsletter_email_unique").on(table.email),
  ]
);

// Type exports
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;
