import { createApp } from "./app";
import { startExampleServer } from "../utils/start-server";

async function start() {
  const app = await createApp();
  startExampleServer(app, {
    name: "Tasks API",
    extraLogs: [(port) => `Swagger UI available at http://localhost:${port}/docs`]
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
