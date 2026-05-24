import { createApp } from "./app";
import { startExampleServer } from "../utils/start-server";

async function start() {
  const app = await createApp();
  startExampleServer(app, {
    name: "Bearer Auth Swagger Demo",
    port: 3001,
    extraLogs: [
      (port) => `Swagger UI: http://localhost:${port}/docs`,
      (port) => `OpenAPI JSON: http://localhost:${port}/openapi.json`,
      () => "Try tokens in Swagger Authorize: user-token or admin-token"
    ]
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
