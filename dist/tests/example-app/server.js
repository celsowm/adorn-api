// tests/example-app/server.ts
// Example Express server using adorn-api
import express from "express";
import bodyParser from "body-parser";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import swaggerUi from "swagger-ui-express";
// Import generated routes
import { RegisterRoutes } from "./routes.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
app.use(bodyParser.json());
// Register the Generated Routes
RegisterRoutes(app);
// Serve Swagger UI
const swaggerDoc = JSON.parse(readFileSync(join(__dirname, "../../swagger.json"), "utf-8"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));
app.listen(3000, () => {
    console.log("🚀 Example server running on http://localhost:3000");
    console.log("📄 Swagger running on http://localhost:3000/docs");
});
