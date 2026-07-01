import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { notifications, users, userProfiles } from "@db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const notificationRouter = createRouter({
  // ─── Get notifications ───
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, ctx.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    // Get actor info for each notification
    const notificationsWithActors = await Promise.all(
      notifs.map(async (notif) => {
        const [actor] = await db
          .select({
            id: users.id,
            name: users.name,
            avatar: users.avatar,
            username: userProfiles.username,
          })
          .from(users)
          .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
          .where(eq(users.id, notif.actorId))
          .limit(1);

        return { ...notif, actor };
      })
    );

    return notificationsWithActors;
  }),

  // ─── Mark as read ───
  markRead: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  // ─── Mark all as read ───
  markAllRead: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, ctx.user.id));

    return { success: true };
  }),

  // ─── Get unread count ───
  unreadCount: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false)
        )
      );

    return { count: result[0]?.count ?? 0 };
  }),
});
