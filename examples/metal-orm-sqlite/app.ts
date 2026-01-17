import { createExpressApp } from "../../src";
import { initializeDatabase } from "./db";
import { UserController } from "./user.controller";

export async function start() {
  await initializeDatabase();

  const app = createExpressApp({ controllers: [UserController] });
  app.listen(3000, () => {
    console.log("SQLite + MetalORM REST example running on http://localhost:3000");
  });
}
