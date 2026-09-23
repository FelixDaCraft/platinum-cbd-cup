/**
 * Health check endpoint for Docker/load balancer health checks.
 *
 * Also reports a small readiness block so a misconfigured deploy can be
 * diagnosed without shell access to the host. It deliberately exposes no
 * secret: only the *domain* of the From address (which is visible on every
 * email the app sends anyway) and booleans saying whether credentials are
 * present — never their values.
 */

import { NextResponse } from "next/server";

import { env } from "~/env";
import { isVivaConfigured } from "~/lib/viva";

/** "Platinum CBD Cup <noreply@example.org>" -> "example.org" */
function senderDomain(from: string): string | null {
  const match = /@([^>\s]+)/.exec(from);
  return match?.[1]?.toLowerCase() ?? null;
}

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "1.0.0",
      config: {
        emailFromDomain: senderDomain(env.EMAIL_FROM),
        emailFromIsDefault: process.env.EMAIL_FROM ? false : true,
        resendKeyConfigured: Boolean(env.RESEND_API_KEY),
        vivaConfigured: isVivaConfigured(),
        vivaEnv: env.VIVA_ENV,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
        authUrl: env.BETTER_AUTH_URL,
      },
    },
    { status: 200 }
  );
}
