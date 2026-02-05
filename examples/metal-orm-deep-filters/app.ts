import { createExpressApp } from "../../src";
import { startExampleServer } from "../utils/start-server";
import { initializeDatabase } from "./db";
import { AlphaController } from "./alpha.controller";

export async function start() {
  await initializeDatabase();

  const app = await createExpressApp({
    controllers: [AlphaController],
    openApi: {
      info: { title: "MetalORM Deep Filters example", version: "1.0.0" },
      docs: true
    }
  });

  startExampleServer(app, {
    name: "MetalORM Deep Filters example",
    extraLogs: [
      (port) => `Alphas: http://localhost:${port}/alphas`,
      (port) => `Delta name filter: http://localhost:${port}/alphas?deltaNameContains=core`,
      (port) => `Score filter: http://localhost:${port}/alphas?charlieScoreGte=90`,
      (port) => `Missing delta: http://localhost:${port}/alphas?deltaMissing=true`
    ]
  });
}
