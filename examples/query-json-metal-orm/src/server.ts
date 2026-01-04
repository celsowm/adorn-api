import { bootstrap } from "adorn-api/express";
import { PostsController } from "./controller.js";
import { initDatabase } from "./db.js";
import type { Request, Response, NextFunction } from "express";

await initDatabase();

await bootstrap({
    controllers: [PostsController],
    port: 3005,
});
