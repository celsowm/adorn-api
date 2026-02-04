import { start } from "./app";

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
