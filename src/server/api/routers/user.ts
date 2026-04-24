/**
 * User Router - single-tenant
 * Handles user-specific operations like role detection and redirect paths.
 */

import { eq, and, count, isNotNull, ne, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { auth } from "~/lib/auth";
import * as schema from "~/server/db/schema";

export const userRouter = createTRPCRouter({
  /**
   * Get the appropriate redirect path after login, based on the user's role.
   */
  getRedirectPath: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({
      headers: ctx.headers,
    });

    if (!session?.user) {
      return { path: "/login", role: null };
    }

    const userId = session.user.id;

    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { isAdmin: true, role: true },
    });

    if (user?.isAdmin || user?.role === "organizer") {
      return { path: "/dashboard", role: "organizer" };
    }

    if (user?.role === "jury") {
      return { path: "/jury/dashboard", role: "jury" };
    }

    if (user?.role === "producer") {
      return { path: "/producer/dashboard", role: "producer" };
    }

    return { path: "/account", role: "user" };
  }),

  /**
   * Get all roles for the current user with stats.
   * Returns roles: organizer, jury, producer with relevant statistics.
   */
  getMyRoles: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({
      headers: ctx.headers,
    });

    if (!session?.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Vous devez être connecté",
      });
    }

    const userId = session.user.id;

    // Organizer role — based on user.role / user.isAdmin
    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { isAdmin: true, role: true },
    });

    let organizerRole = null;
    const isOrganizer = user?.isAdmin === true || user?.role === "organizer";
    if (isOrganizer) {
      const activeCupsResult = await ctx.db
        .select({ count: count() })
        .from(schema.cups)
        .where(ne(schema.cups.status, "completed"));

      organizerRole = {
        type: "organizer" as const,
        activeCups: activeCupsResult[0]?.count ?? 0,
        href: "/cups",
      };
    }

    // Jury role
    const juryMemberships = await ctx.db.query.cupJuries.findMany({
      where: and(
        eq(schema.cupJuries.userId, userId),
        eq(schema.cupJuries.isActive, true)
      ),
      with: {
        cup: { columns: { id: true, name: true, status: true } },
        categoryAssignments: true,
      },
    });

    let juryRole = null;
    if (juryMemberships.length > 0) {
      let pendingRatings = 0;
      const cupsInRating = juryMemberships.filter(
        (j) => j.cup.status === "rating" || j.cup.status === "published"
      );

      for (const jury of cupsInRating) {
        if (jury.categoryAssignments.length > 0) {
          const categoryIds = jury.categoryAssignments.map((a) => a.categoryId);

          const products = await ctx.db
            .select({ id: schema.products.id })
            .from(schema.products)
            .innerJoin(
              schema.registrations,
              eq(schema.products.registrationId, schema.registrations.id)
            )
            .where(
              and(
                eq(schema.registrations.cupId, jury.cupId),
                eq(schema.registrations.status, "confirmed"),
                inArray(schema.products.categoryId, categoryIds)
              )
            );

          const ratedProducts = await ctx.db
            .select({ productId: schema.productRatings.productId })
            .from(schema.productRatings)
            .where(
              and(
                eq(schema.productRatings.juryId, jury.id),
                isNotNull(schema.productRatings.submittedAt)
              )
            );

          const ratedSet = new Set(ratedProducts.map((r) => r.productId));
          pendingRatings += products.filter((p) => !ratedSet.has(p.id)).length;
        }
      }

      juryRole = {
        type: "jury" as const,
        cupCount: juryMemberships.length,
        cupsInRating: cupsInRating.length,
        pendingRatings,
        href: "/jury/dashboard",
      };
    }

    // Producer role
    const producer = await ctx.db.query.producers.findFirst({
      where: eq(schema.producers.userId, userId),
      columns: { id: true, companyName: true },
    });

    let producerRole = null;
    if (producer) {
      const productsResult = await ctx.db
        .select({ count: count() })
        .from(schema.products)
        .innerJoin(
          schema.registrations,
          eq(schema.products.registrationId, schema.registrations.id)
        )
        .where(eq(schema.registrations.producerId, producer.id));

      const activeCompetitionsResult = await ctx.db
        .select({ count: count() })
        .from(schema.registrations)
        .innerJoin(schema.cups, eq(schema.registrations.cupId, schema.cups.id))
        .where(
          and(
            eq(schema.registrations.producerId, producer.id),
            eq(schema.registrations.status, "confirmed"),
            ne(schema.cups.status, "completed")
          )
        );

      producerRole = {
        type: "producer" as const,
        companyName: producer.companyName,
        productCount: productsResult[0]?.count ?? 0,
        activeCompetitions: activeCompetitionsResult[0]?.count ?? 0,
        href: "/producer/dashboard",
      };
    }

    return {
      user: {
        id: userId,
        name: session.user.name,
        email: session.user.email,
      },
      roles: {
        organizer: organizerRole,
        jury: juryRole,
        producer: producerRole,
      },
      hasMultipleRoles:
        [organizerRole, juryRole, producerRole].filter(Boolean).length > 1,
    };
  }),
});
