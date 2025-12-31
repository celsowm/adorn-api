import { bootstrap } from "adorn-api/express";
import { UserController } from "./src/controller.js";

await bootstrap({
  controllers: [UserController],
});

