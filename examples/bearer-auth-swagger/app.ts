import { createExpressApp, type AuthUser } from "../../src";
import { AuthDemoController } from "./auth.controller";

function verifyToken(token: string): AuthUser | null {
  if (token === "user-token") {
    return { id: "user-1", roles: ["user"] };
  }
  if (token === "admin-token") {
    return { id: "admin-1", roles: ["user", "admin"] };
  }
  return null;
}

export async function createApp() {
  return createExpressApp({
    controllers: [AuthDemoController],
    bearerAuth: { verifyToken },
    openApi: {
      info: {
        title: "Bearer Auth Swagger Demo",
        version: "1.0.0",
        description: "Demo for Authorization: Bearer <token> with protected OpenAPI routes."
      },
      path: "/openapi.json",
      docs: true
    }
  });
}
