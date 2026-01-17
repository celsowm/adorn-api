import { createApp } from "./app";

const app = createApp();

app.listen(3000, () => {
  console.log("Tasks API running on http://localhost:3000");
  console.log("Swagger UI available at http://localhost:3000/docs");
});
