import { createExpressApp } from "../../src";
import { initializeDatabase } from "./db";
import { CategoryController } from "./entity.controller";
import { startExampleServer } from "../utils/start-server";

export async function start() {
  await initializeDatabase();

  const app = await createExpressApp({
    controllers: [CategoryController],
    openApi: {
      info: { title: "MetalORM Tree example", version: "1.0.0" },
      docs: true
    }
  });

  startExampleServer(app, {
    name: "MetalORM Tree example",
    extraLogs: [
      (port) => `Tree endpoint: http://localhost:${port}/categories/tree`,
      (port) => `List endpoint: http://localhost:${port}/categories/list`
    ]
  });
}
