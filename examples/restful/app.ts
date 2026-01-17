import { createExpressApp } from "../../src";
import { TaskController } from "./task.controller";

export function createApp() {
  return createExpressApp({
    controllers: [TaskController],
    openApi: {
      info: {
        title: "Tasks API",
        version: "1.0.0"
      },
      docs: true
    }
  });
}
