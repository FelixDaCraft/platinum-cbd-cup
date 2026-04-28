import type { ReactNode } from "react";
import { db } from "~/server/db";
import { PlatinumShell } from "~/components/portal/platinum";

// Don't statically cache — the live status query must run per-request.
export const dynamic = "force-dynamic";

/**
 * Resolves the system-wide "live" indicator state.
 *
 * LIVE  → at least one cup is currently accepting registrations
 *         (status="published" + close date in the future) OR is in
 *         the rating phase (status="rating").
 * IDLE  → none of the above.
 *
 * This drives the topbar live indicator (pulsing dot vs static crosshair).
 */
async function getLiveStatus(): Promise<"live" | "idle"> {
  try {
    const now = new Date();
    const cup = await db.query.cups.findFirst({
      where: (c, { or, and, eq, gt, isNotNull }) =>
        or(
          and(
            eq(c.status, "published"),
            isNotNull(c.registrationCloseAt),
            gt(c.registrationCloseAt, now),
          ),
          eq(c.status, "rating"),
        ),
      columns: { id: true },
    });
    return cup ? "live" : "idle";
  } catch {
    // DB unavailable — fail safe: pretend idle so the topbar still renders.
    return "idle";
  }
}

/**
 * Public portal layout — wraps every public-facing page in the Platinum
 * design shell (sticky topbar + page container + footer).
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const liveStatus = await getLiveStatus();
  return <PlatinumShell liveStatus={liveStatus}>{children}</PlatinumShell>;
}
