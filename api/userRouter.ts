import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, userProfiles, follows, notifications } from "@db/schema";
import { eq, and, like, desc, sql } from "drizzle-orm";

export const userRouter = createRouter({
  // ─── Get user profile ───
  profile: publicQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) return null;

      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, input.userId))
        .limit(1);

      return {
        ...user,
        profile: profile || null,
      };
    }),

  // ─── Get my profile ───
  me: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, ctx.user.id))
      .limit(1);

    return {
      ...user,
      profile: profile || null,
    };
  }),

  // ─── Update profile ───
  updateProfile: authedQuery
    .input(
      z.object({
        username: z.string().min(3).max(50).optional(),
        bio: z.string().max(500).optional(),
        website: z.string().max(255).optional(),
        location: z.string().max(255).optional(),
        name: z.string().max(255).optional(),
        avatar: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Update user
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.avatar !== undefined) updateData.avatar = input.avatar;

      if (Object.keys(updateData).length > 0) {
        await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, ctx.user.id));
      }

      // Update or create profile
      const [existingProfile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, ctx.user.id))
        .limit(1);

      const profileData: Record<string, unknown> = {};
      if (input.username !== undefined) profileData.username = input.username;
      if (input.bio !== undefined) profileData.bio = input.bio;
      if (input.website !== undefined) profileData.website = input.website;
      if (input.location !== undefined) profileData.location = input.location;

      if (existingProfile) {
        await db
          .update(userProfiles)
          .set(profileData)
          .where(eq(userProfiles.id, existingProfile.id));
      } else {
        await db
          .insert(userProfiles)
          .values({
            userId: ctx.user.id,
            username: input.username || null,
            bio: input.bio || null,
            website: input.website || null,
            location: input.location || null,
          });
      }

      return { success: true };
    }),

  // ─── Search users ───
  search: publicQuery
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      const foundUsers = await db
        .select({
          id: users.id,
          name: users.name,
          avatar: users.avatar,
          username: userProfiles.username,
          bio: userProfiles.bio,
        })
        .from(users)
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(
          like(users.name, `%${input.query}%`)
        )
        .limit(input.limit);

      return foundUsers;
    }),

  // ─── Follow user ───
  follow: authedQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      if (ctx.user.id === input.userId) {
        throw new Error("Cannot follow yourself");
      }

      const [existingFollow] = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.followerId, ctx.user.id),
            eq(follows.followingId, input.userId)
          )
        )
        .limit(1);

      if (existingFollow) {
        // Unfollow
        await db.delete(follows).where(eq(follows.id, existingFollow.id));

        await db
          .update(userProfiles)
          .set({ followingCount: sql`followingCount - 1` })
          .where(eq(userProfiles.userId, ctx.user.id));

        await db
          .update(userProfiles)
          .set({ followersCount: sql`followersCount - 1` })
          .where(eq(userProfiles.userId, input.userId));

        return { following: false };
      } else {
        // Follow
        await db.insert(follows).values({
          followerId: ctx.user.id,
          followingId: input.userId,
        });

        await db
          .update(userProfiles)
          .set({ followingCount: sql`followingCount + 1` })
          .where(eq(userProfiles.userId, ctx.user.id));

        await db
          .update(userProfiles)
          .set({ followersCount: sql`followersCount + 1` })
          .where(eq(userProfiles.userId, input.userId));

        // Create notification
        await db.insert(notifications).values({
          userId: input.userId,
          actorId: ctx.user.id,
          type: "follow",
          content: "started following you",
        });

        return { following: true };
      }
    }),

  // ─── Check if following ───
  isFollowing: authedQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const [existingFollow] = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.followerId, ctx.user.id),
            eq(follows.followingId, input.userId)
          )
        )
        .limit(1);

      return { following: !!existingFollow };
    }),

  // ─── Get followers ───
  followers: publicQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const followerList = await db
        .select({
          id: follows.id,
          followerId: follows.followerId,
          createdAt: follows.createdAt,
        })
        .from(follows)
        .where(eq(follows.followingId, input.userId))
        .orderBy(desc(follows.createdAt));

      const followersWithInfo = await Promise.all(
        followerList.map(async (f) => {
          const [user] = await db
            .select({
              id: users.id,
              name: users.name,
              avatar: users.avatar,
              username: userProfiles.username,
            })
            .from(users)
            .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
            .where(eq(users.id, f.followerId))
            .limit(1);

          return { ...f, user };
        })
      );

      return followersWithInfo;
    }),

  // ─── Get following ───
  following: publicQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const followingList = await db
        .select({
          id: follows.id,
          followingId: follows.followingId,
          createdAt: follows.createdAt,
        })
        .from(follows)
        .where(eq(follows.followerId, input.userId))
        .orderBy(desc(follows.createdAt));

      const followingWithInfo = await Promise.all(
        followingList.map(async (f) => {
          const [user] = await db
            .select({
              id: users.id,
              name: users.name,
              avatar: users.avatar,
              username: userProfiles.username,
            })
            .from(users)
            .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
            .where(eq(users.id, f.followingId))
            .limit(1);

          return { ...f, user };
        })
      );

      return followingWithInfo;
    }),

  // ─── Get suggested users ───
  suggested: authedQuery
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(10),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = input?.limit ?? 10;

      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          avatar: users.avatar,
          username: userProfiles.username,
          bio: userProfiles.bio,
        })
        .from(users)
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(sql`${users.id} != ${ctx.user.id}`)
        .limit(limit);

      // Check follow status for each
      const usersWithStatus = await Promise.all(
        allUsers.map(async (user) => {
          const [follow] = await db
            .select()
            .from(follows)
            .where(
              and(
                eq(follows.followerId, ctx.user.id),
                eq(follows.followingId, user.id)
              )
            )
            .limit(1);

          return { ...user, isFollowing: !!follow };
        })
      );

      return usersWithStatus;
    }),
});
