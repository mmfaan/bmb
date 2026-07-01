import { authRouter } from "./auth-router";
import { postRouter } from "./postRouter";
import { userRouter } from "./userRouter";
import { messageRouter } from "./messageRouter";
import { notificationRouter } from "./notificationRouter";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  post: postRouter,
  user: userRouter,
  message: messageRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
