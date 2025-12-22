// src/server.ts
import express from "express";
import bodyParser from "body-parser";
// This is the file we just generated!
import { RegisterRoutes } from "./routes.js";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
const app = express();
app.use(bodyParser.json());
// 1. Register the Generated Routes
RegisterRoutes(app);
// 2. Serve Swagger UI
const swaggerDoc = JSON.parse(readFileSync("./swagger.json", "utf-8"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));
app.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
    console.log("📄 Swagger running on http://localhost:3000/docs");
});
