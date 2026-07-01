import {
  mysqlTable,
  mysqlEnum,
  serial,
  bigint,
  varchar,
  text,
  timestamp,
  boolean,
  int,
} from "drizzle-orm/mysql-core";

// ─── Users ──────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── User Profiles ──────────────────────────────────────
export const userProfiles = mysqlTable("userProfiles", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().unique(),
  username: varchar("username", { length: 50 }).unique(),
  bio: text("bio"),
  website: varchar("website", { length: 255 }),
  location: varchar("location", { length: 255 }),
  isPrivate: boolean("isPrivate").default(false),
  postsCount: int("postsCount").default(0),
  followersCount: int("followersCount").default(0),
  followingCount: int("followingCount").default(0),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

// ─── Posts ──────────────────────────────────────────────
export const posts = mysqlTable("posts", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  caption: text("caption"),
  imageUrl: text("imageUrl"),
  likesCount: int("likesCount").default(0),
  commentsCount: int("commentsCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

// ─── Likes ──────────────────────────────────────────────
export const likes = mysqlTable("likes", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  postId: bigint("postId", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Like = typeof likes.$inferSelect;
export type InsertLike = typeof likes.$inferInsert;

// ─── Comments ───────────────────────────────────────────
export const comments = mysqlTable("comments", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  postId: bigint("postId", { mode: "number", unsigned: true }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

// ─── Follows ────────────────────────────────────────────
export const follows = mysqlTable("follows", {
  id: serial("id").primaryKey(),
  followerId: bigint("followerId", { mode: "number", unsigned: true }).notNull(),
  followingId: bigint("followingId", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Follow = typeof follows.$inferSelect;
export type InsertFollow = typeof follows.$inferInsert;

// ─── Messages ───────────────────────────────────────────
export const messages = mysqlTable("messages", {
  id: serial("id").primaryKey(),
  senderId: bigint("senderId", { mode: "number", unsigned: true }).notNull(),
  receiverId: bigint("receiverId", { mode: "number", unsigned: true }).notNull(),
  content: text("content").notNull(),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── Notifications ──────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  actorId: bigint("actorId", { mode: "number", unsigned: true }).notNull(),
  type: mysqlEnum("type", ["like", "comment", "follow", "message"]).notNull(),
  postId: bigint("postId", { mode: "number", unsigned: true }),
  content: text("content"),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
