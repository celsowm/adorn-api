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
  readOpenApiJson,
  safeRemoveDir
} from "./helpers";

describe("E2E: adorn codegen + express in-memory server", () => {
  it("generates routes + openapi and serves endpoints (no port)", async () => {
    const dir = await mkTmpProjectDir();

    try {
      // ---- fixture files ----
      await setupTestProject(dir, { title: "E2E", version: "1.0.0" });

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
      await generateCode(dir);

      // ---- import generated routes (TS) ----
      const app = await createExpressApp(dir);

      // ---- hit endpoints ----
      const r1 = await request(app).get("/api/users/123");
      expect(r1.status).toBe(200);
      expect(r1.body).toEqual({ id: "123" });

      const r2 = await request(app).post("/api/users").send({ name: "Ana" });
      expect(r2.status).toBe(201);
      expect(r2.body).toEqual({ id: "999", name: "Ana" });

      // ---- assert openapi file exists + contains path ----
      const openapi = await readOpenApiJson(dir);

      expect(openapi.openapi).toBeTruthy();
      expect(openapi.paths["/api/users/{id}"]).toBeTruthy();
      expect(openapi.paths["/api/users"]).toBeTruthy();
    } finally {
      // cleanup
      await safeRemoveDir(dir);
    }
  });
});
