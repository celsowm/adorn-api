import { createApp } from "./app";

async function start() {
  const app = await createApp();
  const PORT = 3000;

  app.listen({ port: PORT }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server running at ${address}`);
    console.log(`OpenAPI documentation: ${address}/openapi.json`);
    console.log(`Swagger UI: ${address}/docs`);
  });
}

start().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
