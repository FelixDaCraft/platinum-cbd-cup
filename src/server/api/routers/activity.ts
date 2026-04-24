import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const activityRouter = createTRPCRouter({
  /**
   * Get recent activities (single-tenant: all activities).
   */
  getRecent: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 10;

      const activities = await ctx.db.query.activityLogs.findMany({
        orderBy: (logs, { desc: descFn }) => [descFn(logs.createdAt)],
        limit,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      return activities.map((activity) => ({
        id: activity.id,
        action: activity.action,
        description: activity.description,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
        createdAt: activity.createdAt,
        user: activity.user
          ? {
              id: activity.user.id,
              name: activity.user.name,
              image: activity.user.image,
            }
          : null,
      }));
    }),
});
