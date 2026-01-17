import { createExpressApp } from "../../src";
import { UserController } from "./user.controller";

export function createApp() {
  return createExpressApp({
    controllers: [UserController],
    openApi: {
      info: {
        title: "Adorn API",
        version: "1.0.0"
      },
      docs: true
    }
  });
}
