import express from "express";
import { createExpressRouter, setupSwagger } from "adorn-api/express";
import { UserController } from "./src/controller.js";

const app = express();
app.use(express.json());

const router = await createExpressRouter({
  controllers: [UserController],
  artifactsDir: "./.adorn",
});

app.use(router);

app.use(setupSwagger({
  artifactsDir: "./.adorn",
  swaggerOptions: {
    servers: [{ url: "http://localhost:3000" }]
  }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Example API: http://localhost:${PORT}`);
  console.log(`📚 Swagger UI: http://localhost:${PORT}/docs`);
});

