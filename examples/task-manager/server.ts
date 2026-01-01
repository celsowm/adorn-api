import { bootstrap } from "adorn-api/express";
import { initializeDatabase, createTables, seedData } from "./src/db.js";
import { TasksController } from "./src/controller.js";
import { TagsController } from "./src/controller.js";
import { StatsController } from "./src/controller.js";

async function main() {
  try {
    await initializeDatabase();
    await createTables();
    await seedData();

    const result = await bootstrap({
      controllers: [TasksController, TagsController, StatsController],
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
