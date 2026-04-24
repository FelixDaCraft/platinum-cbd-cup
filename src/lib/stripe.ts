import Stripe from "stripe";
import { env } from "~/env";

/**
 * Stripe client for the single-tenant Platinum CBD Cup app.
 *
 * The only payment flow is producer registration: a producer pays the
 * registration fee when submitting products for a cup. The checkout
 * session itself is created inline in `routers/registration.ts` using
 * this `stripe` client, and confirmation is handled by
 * `app/api/webhooks/stripe/route.ts`.
 *
 * SaaS-era helpers (organizer signup, upgrade, customer portal,
 * subscription lookup, Stripe Connect) have been removed.
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});
