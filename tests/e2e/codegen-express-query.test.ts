import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import path from "node:path";

import {
  mkTmpProjectDir,
  writeFile,
  setupTestProject,
  generateCode,
  createExpressApp,
  safeRemoveDir
} from "./helpers";

describe("E2E: Query params with smart inference", () => {
  it("extracts path params and query params correctly", async () => {
    const dir = await mkTmpProjectDir();

    try {
      await setupTestProject(dir, { title: "E2E Query", version: "1.0.0" });

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

      await generateCode(dir);
      const app = await createExpressApp(dir);

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
      await safeRemoveDir(dir);
    }
  });
});

describe("E2E: Query params with query-only mode", () => {
  it("extracts all non-path params from query", async () => {
    const dir = await mkTmpProjectDir();

    try {
      await setupTestProject(dir, { 
        title: "E2E Query Only", 
        version: "1.0.0",
        defaultDtoFieldSource: "query"
      });

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

      await generateCode(dir);
      const app = await createExpressApp(dir);

      // Test with query params
      const r = await request(app)
        .get("/api/items/789")
        .query({ filter: "active", limit: "10" });
      
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ id: "789", filter: "active", limit: "10" });

    } finally {
      await safeRemoveDir(dir);
    }
  });
});
