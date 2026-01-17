import { createExpressApp } from "../../src";
import { initializeDatabase } from "./db";
import { PostController } from "./post.controller";
import { UserController } from "./user.controller";

export async function start() {
  await initializeDatabase();

  const app = createExpressApp({
    controllers: [UserController, PostController],
    openApi: {
      info: { title: "SQLite + MetalORM REST example", version: "1.0.0" },
      docs: true
    }
  });
  app.listen(3000, () => {
    console.log("SQLite + MetalORM REST example running on http://localhost:3000");
  });
}
