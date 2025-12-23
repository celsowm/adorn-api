import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ✅ change these imports to match your final API surface
import { loadConfig } from "../../src/config/loadConfig";
import { generateRoutes } from "../../src/codegen/generateRoutes";
import { generateOpenapi } from "../../src/openapi/generateOpenapi";

async function mkTmpProjectDir(): Promise<string> {
  // IMPORTANT: keep it inside repo so Vitest can transpile TS imports from it
  const root = process.cwd();
  const base = path.join(root, ".vitest-tmp");
  await fs.mkdir(base, { recursive: true });
  return fs.mkdtemp(path.join(base, "adorn-e2e-"));
}

async function writeFile(p: string, content: string) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
}

describe("E2E: adorn codegen + express in-memory server", () => {
  it("generates routes + openapi and serves endpoints (no port)", async () => {
    const dir = await mkTmpProjectDir();

    try {
      // ---- fixture files ----
      await writeFile(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              skipLibCheck: true
            },
            include: ["src/**/*.ts"]
          },
          null,
          2
        )
      );

      await writeFile(
        path.join(dir, "adorn.config.ts"),
        `
import { defineConfig } from "adorn-api/config";

export default defineConfig({
  generation: {
    rootDir: ${JSON.stringify(dir)},
    tsConfigPath: "./tsconfig.json",
    controllers: { include: ["src/controllers/**/*.controller.ts"] },
    basePath: "/api",
    framework: "express",
    outputs: {
      routes: "src/generated/routes.ts",
      openapi: "src/generated/openapi.json"
    },
    inference: {
      inferPathParamsFromTemplate: true,
      defaultDtoFieldSource: "smart",
      collisionPolicy: "path-wins"
    }
  },
  swagger: {
    enabled: true,
    info: { title: "E2E", version: "1.0.0" }
  }
});
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/users.controller.ts"),
        `
import { Controller, Get, Post, Status } from "adorn-api/decorators";

class GetUserDto {
  // NOTE: no @FromPath() needed if you implemented "{id}" => dto.id path inference
  id!: string;
}

class CreateUserDto {
  name!: string;
}

@Controller("users")
export class UsersController {
  @Get("{id}")
  async getUser(dto: GetUserDto) {
    return { id: dto.id };
  }

  @Status(201)
  @Post("/")
  async createUser(dto: CreateUserDto) {
    return { id: "999", name: dto.name };
  }
}
`.trim()
      );

      // ---- run codegen ----
      const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });

      await generateRoutes(config);
      await generateOpenapi(config);

      // ---- import generated routes (TS) ----
      const routesFile = path.join(dir, "src/generated/routes.ts");
      const mod = await import(pathToFileURL(routesFile).href);
      const RegisterRoutes = mod.RegisterRoutes as (app: express.Express) => void;

      // ---- in-memory express app (no listen) ----
      const app = express();
      app.use(express.json());
      RegisterRoutes(app);

      // ---- hit endpoints ----
      const r1 = await request(app).get("/api/users/123");
      expect(r1.status).toBe(200);
      expect(r1.body).toEqual({ id: "123" });

      const r2 = await request(app).post("/api/users").send({ name: "Ana" });
      expect(r2.status).toBe(201);
      expect(r2.body).toEqual({ id: "999", name: "Ana" });

      // ---- assert openapi file exists + contains path ----
      const openapiFile = path.join(dir, "src/generated/openapi.json");
      const openapiRaw = await fs.readFile(openapiFile, "utf8");
      const openapi = JSON.parse(openapiRaw);

      expect(openapi.openapi).toBeTruthy();
      expect(openapi.paths["/api/users/{id}"]).toBeTruthy();
      expect(openapi.paths["/api/users"]).toBeTruthy();
    } finally {
      // cleanup
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
