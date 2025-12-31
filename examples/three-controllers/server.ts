import express from "express";
import { createExpressRouter, setupSwagger } from "adorn-api/express";
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

app.use(setupSwagger({
  artifactsDir: "./.adorn",
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Example API: http://localhost:${PORT}`);
  console.log(`📚 Swagger UI: http://localhost:${PORT}/docs`);
});

