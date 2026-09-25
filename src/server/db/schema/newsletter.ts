import { pgTable, text, timestamp, unique, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    // Unsubscribe tracking
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    unsubscribeToken: text("unsubscribe_token"),
    // Source tracking
    source: text("source").default("portal"), // portal, import, manual
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Unique email
    unique("newsletter_email_unique").on(table.email),
    // Les liens de confirmation et de désinscription cherchent par token.
    index("newsletter_subscribers_confirmation_token_idx").on(table.confirmationToken),
    index("newsletter_subscribers_unsubscribe_token_idx").on(table.unsubscribeToken),
    check("newsletter_subscribers_status_check", sql`${table.status} in ('pending', 'active', 'unsubscribed')`),
  ]
);

// Type exports
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;
