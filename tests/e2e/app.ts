import express from "express";
import { registerControllers } from "../../src/index.js";
import { UsersController } from "./controllers/users.controller.js";

export function buildApp(): express.Express {
  const app = express();
  app.use(express.json());

  registerControllers(app, [UsersController], {
    validateResponse: true,
    resolveController: (ctor) => new (ctor as any)()
  });

  return app;
}