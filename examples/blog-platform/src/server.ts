import { bootstrap } from "adorn-api/express";
import { initializeDatabase, createTables, seedData } from "./db.js";
import { UsersController, PostsController, CommentsController, CategoriesController, TagsController } from "./controllers/index.js";

async function main() {
  try {
    await initializeDatabase();
    await createTables();
    await seedData();

    const result = await bootstrap({
      controllers: [UsersController, PostsController, CommentsController, CategoriesController, TagsController],
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
