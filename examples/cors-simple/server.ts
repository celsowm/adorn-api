import "dotenv/config";
import { bootstrap } from "adorn-api/express";
import { HealthController } from "./controllers/HealthController.js";

const shutdownSignals = ["SIGINT", "SIGTERM"] as const;

const main = async () => {
  const result = await bootstrap({
    controllers: [HealthController],
    cors: true,
  });

  console.log("\n✅ CORS enabled with professional defaults:");
  console.log("   - Origins: http://localhost:*, http://127.0.0.1:* (customize with CORS_ALLOWED_ORIGINS env var)");
  console.log("   - Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
  console.log("   - Headers: Content-Type, Authorization, X-Requested-With");
  console.log("   - Credentials: false");
  console.log("");

  for (const signal of shutdownSignals) {
    process.on(signal, async () => {
      await result.close();
      process.exit(0);
    });
  }
};

main().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
