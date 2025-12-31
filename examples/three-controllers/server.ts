import express from "express";
import { createExpressRouter } from "adorn-api/express";
import swaggerUi from "swagger-ui-express";
import { UsersController } from "./src/users.controller.js";
import { PostsController } from "./src/posts.controller.js";
import { CommentsController } from "./src/comments.controller.js";

const app = express();
app.use(express.json());

const router = await createExpressRouter({
  controllers: [UsersController, PostsController, CommentsController],
  artifactsDir: "./.adorn",
});

app.use(router);

app.get("/docs/openapi.json", async (req, res) => {
  // @ts-ignore - file will be generated during build
  res.json((await import("./.adorn/openapi.json")).default);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(null, {
  swaggerOptions: { url: "/docs/openapi.json" },
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Example API: http://localhost:${PORT}`);
  console.log(`📚 Swagger UI: http://localhost:${PORT}/docs`);
});
