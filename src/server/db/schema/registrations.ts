import { pgTable, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cups, type Currency } from "./cups";
import { producers } from "./producers";
import { products } from "./products";

/**
 * Registration status enum values
 * - pending_payment: Inscription en attente de paiement
 * - confirmed: Paiement recu, inscription validee
 * - cancelled: Inscription annulee
 */
export const registrationStatusEnum = [
  "pending_payment",
  "confirmed",
  "cancelled",
] as const;
export type RegistrationStatus = (typeof registrationStatusEnum)[number];

/**
 * Registrations table - Producer registrations to cups
 * Links a producer to a cup with payment status
 */
export const registrations = pgTable(
  "registrations",
  {
    id: text("id").primaryKey(), // nanoid generated
    cupId: text("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "cascade" }),
    producerId: text("producer_id")
      .notNull()
      .references(() => producers.id, { onDelete: "cascade" }),
    status: text("status")
      .notNull()
      .$type<RegistrationStatus>()
      .default("pending_payment"),
    totalAmount: integer("total_amount").notNull().default(0), // Price in cents
    currency: text("currency").$type<Currency>().default("EUR"),
    // Viva.com payment tracking. `paymentOrderCode` is created up-front when
    // the producer is sent to checkout; `paymentTransactionId` lands on the
    // webhook once the payment settles.
    paymentOrderCode: text("payment_order_code"),
    paymentTransactionId: text("payment_transaction_id"),
    // Legacy: payments taken through Stripe before the switch to Viva.com.
    // Kept read-only so old registrations keep their audit trail; nothing
    // writes to it any more.
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    // Invoice fields
    invoiceNumber: text("invoice_number").unique(), // Format: INV-YYYY-XXXXX
    invoiceGeneratedAt: timestamp("invoice_generated_at"),
    invoiceUrl: text("invoice_url"), // URL or path to the stored PDF
    // Synthesis email tracking - Story 8.7
    synthesisEmailSentAt: timestamp("synthesis_email_sent_at"), // When email was sent successfully
    synthesisEmailError: text("synthesis_email_error"), // Error message if send failed
    synthesisEmailAttempts: integer("synthesis_email_attempts").default(0), // Number of send attempts
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // A producer can only have one registration per cup
    unique("registration_producer_cup_unique").on(table.cupId, table.producerId),
  ]
);

/**
 * Registrations relations for Drizzle query builder
 */
export const registrationsRelations = relations(registrations, ({ one, many }) => ({
  cup: one(cups, {
    fields: [registrations.cupId],
    references: [cups.id],
  }),
  producer: one(producers, {
    fields: [registrations.producerId],
    references: [producers.id],
  }),
  products: many(products),
}));

// Type exports for use in other parts of the application
export type Registration = typeof registrations.$inferSelect;
export type NewRegistration = typeof registrations.$inferInsert;
