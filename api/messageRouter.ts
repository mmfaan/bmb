import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { messages, notifications, users, userProfiles } from "@db/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";

export const messageRouter = createRouter({
  // ─── Get conversations list ───
  conversations: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    // Get all messages where current user is sender or receiver
    const allMessages = await db
      .select()
      .from(messages)
      .where(
        or(
          eq(messages.senderId, ctx.user.id),
          eq(messages.receiverId, ctx.user.id)
        )
      )
      .orderBy(desc(messages.createdAt));

    // Group by conversation partner
    const conversationMap = new Map<number, typeof allMessages[0]>();

    for (const msg of allMessages) {
      const partnerId = msg.senderId === ctx.user.id ? msg.receiverId : msg.senderId;
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, msg);
      }
    }

    // Get partner info
    const conversations = await Promise.all(
      Array.from(conversationMap.entries()).map(async ([partnerId, lastMessage]) => {
        const [partner] = await db
          .select({
            id: users.id,
            name: users.name,
            avatar: users.avatar,
            username: userProfiles.username,
          })
          .from(users)
          .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
          .where(eq(users.id, partnerId))
          .limit(1);

        // Count unread messages
        const unreadCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.senderId, partnerId),
              eq(messages.receiverId, ctx.user.id),
              eq(messages.isRead, false)
            )
          );

        return {
          partner,
          lastMessage,
          unreadCount: unreadCount[0]?.count ?? 0,
        };
      })
    );

    return conversations;
  }),

  // ─── Get messages with specific user ───
  withUser: authedQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const chatMessages = await db
        .select()
        .from(messages)
        .where(
          or(
            and(
              eq(messages.senderId, ctx.user.id),
              eq(messages.receiverId, input.userId)
            ),
            and(
              eq(messages.senderId, input.userId),
              eq(messages.receiverId, ctx.user.id)
            )
          )
        )
        .orderBy(messages.createdAt);

      // Mark messages as read
      await db
        .update(messages)
        .set({ isRead: true })
        .where(
          and(
            eq(messages.senderId, input.userId),
            eq(messages.receiverId, ctx.user.id),
            eq(messages.isRead, false)
          )
        );

      return chatMessages;
    }),

  // ─── Send message ───
  send: authedQuery
    .input(
      z.object({
        receiverId: z.number(),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      if (ctx.user.id === input.receiverId) {
        throw new Error("Cannot message yourself");
      }

      const [{ id }] = await db
        .insert(messages)
        .values({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          content: input.content,
        })
        .$returningId();

      // Create notification
      await db.insert(notifications).values({
        userId: input.receiverId,
        actorId: ctx.user.id,
        type: "message",
        content: "sent you a message",
      });

      return { id };
    }),

  // ─── Get unread count ───
  unreadCount: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.receiverId, ctx.user.id),
          eq(messages.isRead, false)
        )
      );

    return { count: result[0]?.count ?? 0 };
  }),
});
