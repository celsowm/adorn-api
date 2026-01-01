import { bootstrap } from "adorn-api/express";
import { initializeDatabase, createTables, seedData } from "./db.js";
import { UsersController, PostsController, CommentsController, CategoriesController, TagsController } from "./controllers/index.js";

async function main() {
  await initializeDatabase();
  await createTables();
  await seedData();

  await bootstrap({
    controllers: [UsersController, PostsController, CommentsController, CategoriesController, TagsController],
  });
}

main().catch(console.error);
