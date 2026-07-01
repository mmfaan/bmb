import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { posts, likes, comments, follows, users, userProfiles, notifications } from "@db/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";

export const postRouter = createRouter({
  // ─── Feed: Posts from followed users + own posts ───
  feed: authedQuery
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      // Get followed user IDs
      const followedUsers = await db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, ctx.user.id));

      const userIds = [ctx.user.id, ...followedUsers.map((f) => f.followingId)];

      // Get posts with authors
      const allPosts = await db
        .select()
        .from(posts)
        .where(inArray(posts.userId, userIds))
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);

      // Get author info for each post
      const postsWithAuthors = await Promise.all(
        allPosts.map(async (post) => {
          const [author] = await db
            .select({
              id: users.id,
              name: users.name,
              avatar: users.avatar,
              username: userProfiles.username,
            })
            .from(users)
            .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
            .where(eq(users.id, post.userId))
            .limit(1);

          // Check if current user liked this post
          const [userLike] = await db
            .select()
            .from(likes)
            .where(and(eq(likes.postId, post.id), eq(likes.userId, ctx.user.id)))
            .limit(1);

          return {
            ...post,
            author,
            isLiked: !!userLike,
          };
        })
      );

      return postsWithAuthors;
    }),

  // ─── Get posts by user ID ───
  byUser: publicQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const userPosts = await db
        .select()
        .from(posts)
        .where(eq(posts.userId, input.userId))
        .orderBy(desc(posts.createdAt));

      const postsWithAuthors = await Promise.all(
        userPosts.map(async (post) => {
          const [author] = await db
            .select({
              id: users.id,
              name: users.name,
              avatar: users.avatar,
              username: userProfiles.username,
            })
            .from(users)
            .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
            .where(eq(users.id, post.userId))
            .limit(1);

          return { ...post, author };
        })
      );

      return postsWithAuthors;
    }),

  // ─── Get single post ───
  byId: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [post] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, input.id))
        .limit(1);

      if (!post) return null;

      const [author] = await db
        .select({
          id: users.id,
          name: users.name,
          avatar: users.avatar,
          username: userProfiles.username,
        })
        .from(users)
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(eq(users.id, post.userId))
        .limit(1);

      // Get comments
      const postComments = await db
        .select()
        .from(comments)
        .where(eq(comments.postId, post.id))
        .orderBy(desc(comments.createdAt));

      const commentsWithAuthors = await Promise.all(
        postComments.map(async (comment) => {
          const [commentAuthor] = await db
            .select({
              id: users.id,
              name: users.name,
              avatar: users.avatar,
            })
            .from(users)
            .where(eq(users.id, comment.userId))
            .limit(1);

          return { ...comment, author: commentAuthor };
        })
      );

      return { ...post, author, allComments: commentsWithAuthors };
    }),

  // ─── Create post ───
  create: authedQuery
    .input(
      z.object({
        caption: z.string().max(2200),
        imageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [{ id }] = await db
        .insert(posts)
        .values({
          userId: ctx.user.id,
          caption: input.caption,
          imageUrl: input.imageUrl || null,
        })
        .$returningId();

      // Update user profile posts count
      await db
        .update(userProfiles)
        .set({
          postsCount: sql`postsCount + 1`,
        })
        .where(eq(userProfiles.userId, ctx.user.id));

      return { id };
    }),

  // ─── Delete post ───
  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [post] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, input.id))
        .limit(1);

      if (!post || post.userId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      await db.delete(likes).where(eq(likes.postId, input.id));
      await db.delete(comments).where(eq(comments.postId, input.id));
      await db.delete(posts).where(eq(posts.id, input.id));

      // Update user profile posts count
      await db
        .update(userProfiles)
        .set({
          postsCount: sql`postsCount - 1`,
        })
        .where(eq(userProfiles.userId, ctx.user.id));

      return { success: true };
    }),

  // ─── Toggle like ───
  toggleLike: authedQuery
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [existingLike] = await db
        .select()
        .from(likes)
        .where(and(eq(likes.postId, input.postId), eq(likes.userId, ctx.user.id)))
        .limit(1);

      if (existingLike) {
        // Unlike
        await db.delete(likes).where(eq(likes.id, existingLike.id));
        await db
          .update(posts)
          .set({ likesCount: sql`likesCount - 1` })
          .where(eq(posts.id, input.postId));
        return { liked: false };
      } else {
        // Like
        await db.insert(likes).values({
          userId: ctx.user.id,
          postId: input.postId,
        });
        await db
          .update(posts)
          .set({ likesCount: sql`likesCount + 1` })
          .where(eq(posts.id, input.postId));

        // Create notification
        const [post] = await db
          .select()
          .from(posts)
          .where(eq(posts.id, input.postId))
          .limit(1);

        if (post && post.userId !== ctx.user.id) {
          await db.insert(notifications).values({
            userId: post.userId,
            actorId: ctx.user.id,
            type: "like",
            postId: input.postId,
            content: "liked your post",
          });
        }

        return { liked: true };
      }
    }),

  // ─── Add comment ───
  addComment: authedQuery
    .input(
      z.object({
        postId: z.number(),
        content: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [{ id }] = await db
        .insert(comments)
        .values({
          userId: ctx.user.id,
          postId: input.postId,
          content: input.content,
        })
        .$returningId();

      await db
        .update(posts)
        .set({ commentsCount: sql`commentsCount + 1` })
        .where(eq(posts.id, input.postId));

      // Create notification
      const [post] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, input.postId))
        .limit(1);

      if (post && post.userId !== ctx.user.id) {
        await db.insert(notifications).values({
          userId: post.userId,
          actorId: ctx.user.id,
          type: "comment",
          postId: input.postId,
          content: `commented: "${input.content}"`,
        });
      }

      return { id };
    }),

  // ─── Delete comment ───
  deleteComment: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const [comment] = await db
        .select()
        .from(comments)
        .where(eq(comments.id, input.id))
        .limit(1);

      if (!comment || comment.userId !== ctx.user.id) {
        throw new Error("Unauthorized");
      }

      await db.delete(comments).where(eq(comments.id, input.id));
      await db
        .update(posts)
        .set({ commentsCount: sql`commentsCount - 1` })
        .where(eq(posts.id, comment.postId));

      return { success: true };
    }),

  // ─── Explore: Get all public posts ───
  explore: publicQuery
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      const allPosts = await db
        .select()
        .from(posts)
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);

      const postsWithAuthors = await Promise.all(
        allPosts.map(async (post) => {
          const [author] = await db
            .select({
              id: users.id,
              name: users.name,
              avatar: users.avatar,
              username: userProfiles.username,
            })
            .from(users)
            .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
            .where(eq(users.id, post.userId))
            .limit(1);

          return { ...post, author };
        })
      );

      return postsWithAuthors;
    }),
});
