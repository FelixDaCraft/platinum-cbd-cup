import type { ReactNode } from "react";
import { unstable_cache } from "next/cache";
import { db } from "~/server/db";
import { PlatinumShell } from "~/components/portal/platinum";

// Le layout reste dynamique (les pages enfants lisent la base et la session),
// mais la requête « live » ci-dessous est mémoïsée : elle tournait sinon une
// fois par requête HTTP du portail, y compris sur /login, /contact ou les
// pages légales qui n'en dépendent en rien.
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
 * Version mémoïsée de getLiveStatus.
 *
 * L'indicateur bascule au plus quelques fois par an (ouverture des
 * inscriptions, passage en notation) : une minute de fraîcheur est
 * largement suffisante et supprime une requête SQL par page vue.
 *
 * Le tag permettra une invalidation immédiate le jour où cup.update et
 * publishResults appelleront revalidateTag("cups") — voir le rapport.
 */
const getCachedLiveStatus = unstable_cache(getLiveStatus, ["portal-live-status"], {
  revalidate: 60,
  tags: ["cups"],
});

/**
 * Public portal layout — wraps every public-facing page in the Platinum
 * design shell (sticky topbar + page container + footer).
 */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const liveStatus = await getCachedLiveStatus();
  return <PlatinumShell liveStatus={liveStatus}>{children}</PlatinumShell>;
}
