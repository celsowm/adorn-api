import { createApp } from "./app";
import { startExampleServer } from "../utils/start-server";

const app = createApp();

startExampleServer(app, {
  name: "Tasks API",
  extraLogs: [(port) => `Swagger UI available at http://localhost:${port}/docs`]
});
