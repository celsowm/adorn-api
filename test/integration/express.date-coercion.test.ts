import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import express from "express";
import request from "supertest";
import { Controller, Post } from "../../dist/index.js";
import type { ManifestV1 } from "../../src/compiler/manifest/format.js";

beforeAll(() => {
  execSync("npm run build", { cwd: resolve(__dirname, "../.."), stdio: "inherit" });
});

class DateInput {
  when!: Date;
}

@Controller("/dates")
class DateController {
  @Post("/")
  async create(body: DateInput) {
    return { isDate: body.when instanceof Date };
  }
}

describe("Express Date Coercion", () => {
  it("coerces date-time strings in the request body when enabled", async () => {
    const { createExpressRouter } = await import("../../dist/express.js");

    const manifest: ManifestV1 = {
      manifestVersion: 1,
      generatedAt: new Date().toISOString(),
      generator: { name: "adorn-api", version: "0.1.0", typescript: "5.x" },
      schemas: { kind: "openapi-3.1", file: "./openapi.json", componentsSchemasPointer: "/components/schemas" },
      validation: { mode: "ajv-runtime", precompiledModule: null },
      controllers: [
        {
          controllerId: "DateController",
          basePath: "/dates",
          operations: [
            {
              operationId: "DateController_create",
              http: { method: "POST", path: "/" },
              handler: { methodName: "create" },
              args: {
                body: { index: 0, required: true, contentType: "application/json", schemaRef: "#/components/schemas/DateInput" },
                path: [],
                query: [],
                headers: [],
                cookies: [],
              },
              responses: [{ status: 201, contentType: "application/json", schemaRef: "#/components/schemas/InlineResponse" }],
            },
          ],
        },
      ],
    };

    const openapi = {
      openapi: "3.1.0",
      components: {
        schemas: {
          DateInput: {
            type: "object",
            properties: {
              when: { type: "string", format: "date-time" },
            },
            required: ["when"],
          },
        },
      },
      paths: {
        "/dates/": {
          post: {
            operationId: "DateController_create",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DateInput" },
                },
              },
            },
            responses: {
              "201": {
                description: "Created",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { isDate: { type: "boolean" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const app = express();
    app.use(express.json());
    app.use(await createExpressRouter({
      controllers: [DateController],
      manifest,
      openapi,
      coerce: { body: true, dateTime: true },
    }));

    const res = await request(app)
      .post("/dates/")
      .send({ when: "2025-01-22T00:00:00.000Z" });

    expect(res.status).toBe(201);
    expect(res.body.isDate).toBe(true);
  });
});
