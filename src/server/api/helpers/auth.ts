/**
 * Authentication & Authorization Helpers
 * Single-tenant role-based helpers.
 */

import { TRPCError } from "@trpc/server";
import { auth } from "~/lib/auth";
import { ERROR_MESSAGES } from "~/lib/errors";
import type { db as dbType } from "~/server/db";

// ============================================
// TYPES
// ============================================

export interface AuthContext {
  headers: Headers;
  db: typeof dbType;
}

export interface AuthenticatedSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    emailVerified: boolean;
    role?: string;
    isAdmin?: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

export interface AuthResult {
  session: AuthenticatedSession;
  userId: string;
}

export interface OrganizerResult extends AuthResult {
  isOrganizer: true;
}

// ============================================
// AUTH HELPERS
// ============================================

/**
 * Require authenticated session
 * @throws UNAUTHORIZED if not logged in
 */
export async function requireAuth(ctx: AuthContext): Promise<AuthResult> {
  const session = await auth.api.getSession({ headers: ctx.headers });

  if (!session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ERROR_MESSAGES.UNAUTHORIZED,
    });
  }

  return {
    session: session as AuthenticatedSession,
    userId: session.user.id,
  };
}

/**
 * Require authenticated session + organizer role (or isAdmin flag).
 * @throws UNAUTHORIZED if not logged in
 * @throws FORBIDDEN if not an organizer / admin
 */
export async function requireOrganizer(
  ctx: AuthContext,
  action?: string
): Promise<OrganizerResult> {
  const { session, userId } = await requireAuth(ctx);

  const user = session.user;
  const isOrganizer = user.isAdmin === true || user.role === "organizer";

  if (!isOrganizer) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: action
        ? `Seul un organisateur peut ${action}`
        : ERROR_MESSAGES.FORBIDDEN,
    });
  }

  return {
    session,
    userId,
    isOrganizer: true,
  };
}

/**
 * Verify cup exists (single-tenant: no organization scoping).
 * @throws NOT_FOUND if cup doesn't exist
 */
export async function requireCupAccess(
  ctx: AuthContext,
  cupId: string
) {
  const cup = await ctx.db.query.cups.findFirst({
    where: (cups, { eq }) => eq(cups.id, cupId),
  });

  if (!cup) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: ERROR_MESSAGES.CUP_NOT_FOUND,
    });
  }

  return cup;
}

/**
 * Combined: require organizer + verify cup access
 */
export async function requireOrganizerWithCup(
  ctx: AuthContext,
  cupId: string,
  action?: string
) {
  const organizer = await requireOrganizer(ctx, action);
  const cup = await requireCupAccess(ctx, cupId);
  return { organizer, cup };
}

/**
 * Combined: require any logged-in user + verify cup access
 * For read-only operations on cups
 */
export async function requireAuthWithCup(ctx: AuthContext, cupId: string) {
  const auth = await requireAuth(ctx);
  const cup = await requireCupAccess(ctx, cupId);
  return { auth, cup };
}
