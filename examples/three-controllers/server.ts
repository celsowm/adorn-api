import { bootstrap } from "adorn-api/express";
import { UsersController } from "./src/users.controller.js";
import { PostsController } from "./src/posts.controller.js";
import { CommentsController } from "./src/comments.controller.js";

await bootstrap({
  controllers: [UsersController, PostsController, CommentsController],
});

