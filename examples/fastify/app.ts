import { createFastifyApp } from "../../src";
import { UserController } from "../basic/user.controller";

export async function createApp() {
  const app = await createFastifyApp({
    controllers: [UserController],
    openApi: {
      info: {
        title: "Adorn API (Fastify)",
        version: "1.0.0"
      },
      docs: true
    }
  });
  return app;
}
