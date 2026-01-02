import { bootstrap } from "adorn-api/express";
import { initDatabase } from "./db.js";
import { UsersController, BlogPostsController, CommentsController, CategoriesController, TagsController } from "./controllers/index.js";

async function main() {
  try {
    await initDatabase();

    const result = await bootstrap({
      controllers: [UsersController, BlogPostsController, CommentsController, CategoriesController, TagsController],
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
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
