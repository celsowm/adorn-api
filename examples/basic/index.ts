import { createApp } from "./app";
import { startExampleServer } from "../utils/start-server";

async function start() {
  const app = await createApp();
  startExampleServer(app, { name: "Adorn API" });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
