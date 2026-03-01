import { router } from "../trpc";
import { userRouter } from "./user";
import { videoRouter } from "./video";
import { gameRouter } from "./game";
import { imageRouter } from "./image";
import { tagRouter } from "./tag";
import { adminRouter } from "./admin";
import { commentRouter } from "./comment";
import { gameCommentRouter } from "./game-comment";
import { imagePostCommentRouter } from "./image-comment";
import { seriesRouter } from "./series";
import { siteRouter } from "./site";

export const appRouter = router({
  user: userRouter,
  video: videoRouter,
  game: gameRouter,
  image: imageRouter,
  tag: tagRouter,
  admin: adminRouter,
  comment: commentRouter,
  gameComment: gameCommentRouter,
  imagePostComment: imagePostCommentRouter,
  series: seriesRouter,
  site: siteRouter,
});

export type AppRouter = typeof appRouter;
