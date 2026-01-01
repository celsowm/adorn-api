import { bootstrap } from "adorn-api/express";
import { UsersController } from "./src/users.controller.js";
import { PostsController } from "./src/posts.controller.js";
import { CommentsController } from "./src/comments.controller.js";

async function main() {
  try {
    const result = await bootstrap({
      controllers: [UsersController, PostsController, CommentsController],
    });

    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await result.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Shutting down...');
      await result.close();
      process.exit(0);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

main();
