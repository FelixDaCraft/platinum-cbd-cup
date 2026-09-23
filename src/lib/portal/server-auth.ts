/**
 * Server-side authentication helpers for portal layouts.
 *
 * Single-tenant (Platinum CBD Cup): no organization resolution. Role is
 * determined by:
 *   1. `users.isAdmin` or `users.role === "organizer"` → organizer
 *   2. Existence of a producer profile → producer
 *   3. Existence of a jury profile → jury
 */

import { headers } from "next/headers";
import { db } from "~/server/db";
import { auth } from "~/lib/auth";

export type PortalRole = "organizer" | "producer" | "jury" | null;

interface UserAccessResult {
  hasAccess: boolean;
  role: PortalRole;
  /**
   * True when the user is a producer by role but has not created their
   * producer profile yet. They may only reach `/producer/complete-profile`.
   */
  needsProducerProfile: boolean;
}

/**
 * Check user's role for the app.
 * Returns the user's role (organizer/producer/jury) or null if no access.
 */
export async function getUserPortalAccess(): Promise<UserAccessResult> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user?.id) {
    return { hasAccess: false, role: null, needsProducerProfile: false };
  }

  const userId = session.user.id;

  // 1. Organizer — flagged on the user record (isAdmin or role === "organizer")
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: { id: true, role: true, isAdmin: true },
  });

  if (user?.isAdmin || user?.role === "organizer") {
    return { hasAccess: true, role: "organizer", needsProducerProfile: false };
  }

  // 2. Producer — has a producer profile
  const producerProfile = await db.query.producers.findFirst({
    where: (producers, { eq }) => eq(producers.userId, userId),
    columns: { id: true },
  });

  if (producerProfile) {
    return { hasAccess: true, role: "producer", needsProducerProfile: false };
  }

  // 3. Jury — has a jury profile
  const juryProfile = await db.query.juryProfiles.findFirst({
    where: (juryProfiles, { eq }) => eq(juryProfiles.userId, userId),
    columns: { id: true },
  });

  if (juryProfile) {
    return { hasAccess: true, role: "jury", needsProducerProfile: false };
  }

  // 4. Producer by role, but the profile has not been created yet.
  //    Public sign-ups land here: `signUp.email` only creates the user row,
  //    the producer profile is created later by `/producer/complete-profile`.
  //    Without this branch such users bounce forever between `/login` and
  //    `/producer/dashboard`.
  if (user?.role === "producer") {
    return { hasAccess: true, role: "producer", needsProducerProfile: true };
  }

  return { hasAccess: false, role: null, needsProducerProfile: false };
}

/**
 * Check if user has access to producer area.
 * Organizers have access to all areas.
 */
export async function hasProducerAccess(): Promise<boolean> {
  const access = await getUserPortalAccess();
  return access.role === "producer" || access.role === "organizer";
}

/**
 * Check if user has access to jury area.
 * Organizers have access to all areas.
 */
export async function hasJuryAccess(): Promise<boolean> {
  const access = await getUserPortalAccess();
  return access.role === "jury" || access.role === "organizer";
}

/**
 * Check if user has access to organizer/dashboard area.
 */
export async function hasOrganizerAccess(): Promise<boolean> {
  const access = await getUserPortalAccess();
  return access.role === "organizer";
}
