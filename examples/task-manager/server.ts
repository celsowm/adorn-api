import { bootstrap } from "adorn-api/express";
import { initializeDatabase, createTables, seedData } from "./src/db.js";
import { TasksController } from "./src/controller.js";
import { TagsController } from "./src/controller.js";
import { StatsController } from "./src/controller.js";

await initializeDatabase();
await createTables();
await seedData();

await bootstrap({
  controllers: [TasksController, TagsController, StatsController],
});
