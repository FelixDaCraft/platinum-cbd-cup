/**
 * Server-side authentication helpers for portal layouts.
 *
 * Single-tenant (Platinum CBD Cup): no organization resolution. A user can
 * hold several roles at once — the schema allows it ("A user can also be a
 * jury or producer via their profiles") and `juryCodes.activate` creates a
 * jury profile for whoever is signed in, producers included. `roles` lists
 * everything the user holds; `role` is only the default landing role:
 *   1. `users.isAdmin` or `users.role === "organizer"` → organizer
 *   2. Existence of a producer profile → producer
 *   3. Existence of a jury profile → jury
 */

import { cache } from "react";
import { headers } from "next/headers";
import { db } from "~/server/db";
import { auth } from "~/lib/auth";

export type PortalRole = "organizer" | "producer" | "jury" | null;

interface UserAccessResult {
  hasAccess: boolean;
  /** Rôle de destination par défaut (le premier de `roles`). */
  role: PortalRole;
  /** Tous les rôles détenus. Un producteur peut aussi être juré. */
  roles: Exclude<PortalRole, null>[];
  /**
   * True when the user is a producer by role but has not created their
   * producer profile yet. They may only reach `/producer/complete-profile`.
   */
  needsProducerProfile: boolean;
}

/**
 * Session courante, dédupliquée sur le rendu serveur.
 *
 * Les layouts et `getUserPortalAccess` la demandaient chacun de leur côté,
 * soit deux résolutions de cookie par navigation.
 */
export const getPortalSession = cache(async () => {
  const headersList = await headers();
  return auth.api.getSession({ headers: headersList });
});

const NO_ACCESS: UserAccessResult = {
  hasAccess: false,
  role: null,
  roles: [],
  needsProducerProfile: false,
};

/**
 * Check user's roles for the app.
 * Returns every role held (organizer/producer/jury), empty if no access.
 */
export const getUserPortalAccess = cache(
  async (): Promise<UserAccessResult> => {
    const session = await getPortalSession();

    if (!session?.user?.id) {
      return NO_ACCESS;
    }

    const userId = session.user.id;

    const [user, producerProfile, juryProfile] = await Promise.all([
      db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, userId),
        columns: { id: true, role: true, isAdmin: true },
      }),
      db.query.producers.findFirst({
        where: (producers, { eq }) => eq(producers.userId, userId),
        columns: { id: true },
      }),
      db.query.juryProfiles.findFirst({
        where: (juryProfiles, { eq }) => eq(juryProfiles.userId, userId),
        columns: { id: true },
      }),
    ]);

    const roles: Exclude<PortalRole, null>[] = [];

    // 1. Organizer — flagged on the user record (isAdmin or role === "organizer")
    if (user?.isAdmin || user?.role === "organizer") {
      roles.push("organizer");
    }

    // 2. Producer — has a producer profile
    if (producerProfile) {
      roles.push("producer");
    }

    // 3. Jury — has a jury profile
    if (juryProfile) {
      roles.push("jury");
    }

    if (roles.length > 0) {
      return {
        hasAccess: true,
        role: roles[0]!,
        roles,
        needsProducerProfile: false,
      };
    }

    // 4. Producer by role, but the profile has not been created yet.
    //    Public sign-ups land here: `signUp.email` only creates the user row,
    //    the producer profile is created later by `/producer/complete-profile`.
    //    Without this branch such users bounce forever between `/login` and
    //    `/producer/dashboard`.
    if (user?.role === "producer") {
      return {
        hasAccess: true,
        role: "producer",
        roles: ["producer"],
        needsProducerProfile: true,
      };
    }

    return NO_ACCESS;
  }
);

/**
 * Check if user has access to producer area.
 * Organizers have access to all areas.
 */
export async function hasProducerAccess(): Promise<boolean> {
  const { roles } = await getUserPortalAccess();
  return roles.includes("producer") || roles.includes("organizer");
}

/**
 * Check if user has access to jury area.
 * Organizers have access to all areas.
 */
export async function hasJuryAccess(): Promise<boolean> {
  const { roles } = await getUserPortalAccess();
  return roles.includes("jury") || roles.includes("organizer");
}

/**
 * Check if user has access to organizer/dashboard area.
 */
export async function hasOrganizerAccess(): Promise<boolean> {
  const { roles } = await getUserPortalAccess();
  return roles.includes("organizer");
}
