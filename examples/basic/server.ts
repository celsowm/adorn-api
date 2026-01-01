import { bootstrap } from "adorn-api/express";
import { UserController } from "./src/controller.js";

async function main() {
  await bootstrap({
    controllers: [UserController],
  });
}

main().catch(console.error);
