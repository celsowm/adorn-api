import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadConfig } from "../../src/config/loadConfig";
import { generateRoutes } from "../../src/codegen/generateRoutes";
import { generateOpenapi } from "../../src/openapi/generateOpenapi";

async function mkTmpProjectDir(): Promise<string> {
  const root = process.cwd();
  const base = path.join(root, ".vitest-tmp");
  await fs.mkdir(base, { recursive: true });
  return fs.mkdtemp(path.join(base, "adorn-e2e-query-"));
}

async function writeFile(p: string, content: string) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
}

describe("E2E: Query params with smart inference", () => {
  it("extracts path params and query params correctly", async () => {
    const dir = await mkTmpProjectDir();

    try {
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
    info: { title: "E2E Query", version: "1.0.0" }
  }
});
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/products.controller.ts"),
        `
import { Controller, Get } from "adorn-api/decorators";

class GetProductDto {
  id!: string;
  category?: string;
  page?: number;
}

@Controller("products")
export class ProductsController {
  @Get("{id}")
  async getProduct(dto: GetProductDto) {
    return {
      id: dto.id,
      category: dto.category,
      page: dto.page
    };
  }
}
`.trim()
      );

      const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });

      await generateRoutes(config);
      await generateOpenapi(config);

      const routesFile = path.join(dir, "src/generated/routes.ts");
      const mod = await import(pathToFileURL(routesFile).href);
      const RegisterRoutes = mod.RegisterRoutes as (app: express.Express) => void;

      const app = express();
      app.use(express.json());
      RegisterRoutes(app);

      // Test with path param and query params
      const r1 = await request(app)
        .get("/api/products/123")
        .query({ category: "electronics", page: "2" });
      
      expect(r1.status).toBe(200);
      expect(r1.body).toEqual({ id: "123", category: "electronics", page: "2" });

      // Test with only path param
      const r2 = await request(app).get("/api/products/456");
      expect(r2.status).toBe(200);
      expect(r2.body).toEqual({ id: "456", category: undefined, page: undefined });

    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("E2E: Query params with query-only mode", () => {
  it("extracts all non-path params from query", async () => {
    const dir = await mkTmpProjectDir();

    try {
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
      defaultDtoFieldSource: "query",
      collisionPolicy: "path-wins"
    }
  },
  swagger: {
    enabled: true,
    info: { title: "E2E Query Only", version: "1.0.0" }
  }
});
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/items.controller.ts"),
        `
import { Controller, Get } from "adorn-api/decorators";

class GetItemDto {
  id!: string;
  filter?: string;
  limit?: number;
}

@Controller("items")
export class ItemsController {
  @Get("{id}")
  async getItem(dto: GetItemDto) {
    return {
      id: dto.id,
      filter: dto.filter,
      limit: dto.limit
    };
  }
}
`.trim()
      );

      const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });

      await generateRoutes(config);
      await generateOpenapi(config);

      const routesFile = path.join(dir, "src/generated/routes.ts");
      const mod = await import(pathToFileURL(routesFile).href);
      const RegisterRoutes = mod.RegisterRoutes as (app: express.Express) => void;

      const app = express();
      app.use(express.json());
      RegisterRoutes(app);

      // Test with query params
      const r = await request(app)
        .get("/api/items/789")
        .query({ filter: "active", limit: "10" });
      
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ id: "789", filter: "active", limit: "10" });

    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
