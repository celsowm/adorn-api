import { bootstrap } from "adorn-api/express";
import { AuthController, ApiController } from "./src/controller.js";

async function main() {
  try {
    const authRuntime = {
      name: "BearerAuth",
      async authenticate(req: any) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return null;
        }
        const token = authHeader.slice(7);
        const tokens = (global as any).__authTokens;
        if (!tokens) return null;
        const user = tokens.get(token);
        if (!user) return null;
        return {
          principal: user,
          scopes: user.scopes || [],
        };
      },
      challenge(res: any) {
        res.setHeader("WWW-Authenticate", 'Bearer realm="access"');
        res.status(401).json({
          error: "Unauthorized",
          message: "Missing or invalid Bearer token. Please login at POST /auth/login",
        });
      },
      authorize(auth: any, requiredScopes: string[]) {
        if (requiredScopes.length === 0) return true;
        const userScopes = auth.scopes || [];
        return requiredScopes.every((scope: string) => userScopes.includes(scope));
      },
    };

    (global as any).__authTokens = new Map();

    const result = await bootstrap({
      controllers: [AuthController, ApiController],
      auth: {
        schemes: { BearerAuth: authRuntime },
      },
    });

    console.log("\n📝 Test Credentials:");
    console.log("  Alice (admin): username='alice', password='password123', scopes=['read', 'write', 'admin']");
    console.log("  Bob (user):    username='bob', password='password123', scopes=['read']");
    console.log("");

    process.on("SIGINT", async () => {
      console.log("\nShutting down...");
      await result.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\nShutting down...");
      await result.close();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

main();
