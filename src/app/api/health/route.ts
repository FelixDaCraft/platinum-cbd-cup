/**
 * Health check endpoint for Docker/load balancer health checks.
 *
 * Probes the database so a container whose DATABASE_URL is wrong (or whose
 * Postgres is down) reports 503 instead of a cheerful 200 — the deploy gate
 * and Docker's restart policy both rely on this answer.
 *
 * Also reports a small readiness block so a misconfigured deploy can be
 * diagnosed without shell access to the host. It deliberately exposes no
 * secret: only the *domain* of the From address (which is visible on every
 * email the app sends anyway) and booleans saying whether credentials are
 * present — never their values. It is still withheld from requests coming
 * through the public tunnel: reconnaissance value with no public use.
 */

import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { isVivaConfigured } from "~/lib/viva";

// Never let a build-time render freeze this answer.
export const dynamic = "force-dynamic";

const DB_PROBE_TIMEOUT_MS = 2000;

/** "Platinum CBD Cup <noreply@example.org>" -> "example.org" */
function senderDomain(from: string): string | null {
  const match = /@([^>\s]+)/.exec(from);
  return match?.[1]?.toLowerCase() ?? null;
}

async function probeDatabase(): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("db probe timeout")),
          DB_PROBE_TIMEOUT_MS
        );
      }),
    ]);
    return true;
  } catch (error) {
    console.error("[health] database probe failed:", error);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  // Cloudflare stamps CF-Connecting-IP on everything coming through the
  // tunnel; the container's own healthcheck hits the port directly.
  const isLocalProbe = !request.headers.get("cf-connecting-ip");

  // La sonde base n'est faite QUE pour le healthcheck local. Exposée
  // publiquement, elle offrait un `select 1` sur le pool Postgres par
  // requête anonyme, sans limite de débit et sans cache (`force-dynamic`) —
  // une amplification que l'endpoint n'offrait pas auparavant.
  const databaseUp = isLocalProbe ? await probeDatabase() : null;

  // Une requête publique ne reçoit qu'un accusé de vie du processus : ni
  // l'état de la base, ni la configuration. Elle ne peut donc pas répondre
  // 503 sur une base injoignable, ce qui n'est de toute façon pas son rôle —
  // le healthcheck du conteneur, lui, passe par la sonde locale.
  if (!isLocalProbe) {
    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      status: databaseUp ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      // Injected at build time (docker build --build-arg / deploy workflow).
      // Falls back to the package version, which is absent under `node server.js`.
      version:
        process.env.APP_VERSION ?? process.env.npm_package_version ?? "unknown",
      database: databaseUp ? "up" : "down",
      ...(isLocalProbe
        ? {
            config: {
              emailFromDomain: senderDomain(env.EMAIL_FROM),
              emailFromIsDefault: process.env.EMAIL_FROM ? false : true,
              resendKeyConfigured: Boolean(env.RESEND_API_KEY),
              vivaConfigured: isVivaConfigured(),
              vivaEnv: env.VIVA_ENV,
              appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
              authUrl: env.BETTER_AUTH_URL,
            },
          }
        : {}),
    },
    { status: databaseUp ? 200 : 503 }
  );
}
