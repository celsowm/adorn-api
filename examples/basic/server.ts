import { bootstrap } from "adorn-api/express";
import { UserController } from "./src/controller.js";

async function main() {
  try {
    const result = await bootstrap({
      controllers: [UserController],
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
