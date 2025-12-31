import express from "express";
import { createExpressRouter } from "adorn-api/express";
import swaggerUi from "swagger-ui-express";
import { UserController } from "./src/controller.js";

const app = express();
app.use(express.json());

const router = await createExpressRouter({
  controllers: [UserController],
  artifactsDir: "./.adorn",
});

app.use("/api", router);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(null, {
  swaggerOptions: { url: "/docs/openapi.json" },
}));

app.get("/docs/openapi.json", (req, res) => {
  res.json(require("./.adorn/openapi.json"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Example API: http://localhost:${PORT}`);
  console.log(`📚 Swagger UI: http://localhost:${PORT}/docs`);
});
