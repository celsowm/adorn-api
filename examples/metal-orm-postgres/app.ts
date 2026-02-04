import { createExpressApp } from "../../src";
import { initializeDatabase } from "./db";
import { PostController } from "./post.controller";
import { UserController } from "./user.controller";
import { startExampleServer } from "../utils/start-server";

export async function start() {
  await initializeDatabase();

  const app = await createExpressApp({
    controllers: [UserController, PostController],
    openApi: {
      info: { title: "Postgres (PGlite) + MetalORM REST example", version: "1.0.0" },
      docs: true
    }
  });
  startExampleServer(app, { name: "Postgres (PGlite) + MetalORM REST example" });
}
