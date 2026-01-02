import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import express from "express";
import request from "supertest";
import { createProgramFromConfig } from "../../src/compiler/runner/createProgram.js";
import { scanControllers } from "../../src/compiler/analyze/scanControllers.js";
import { generateManifest } from "../../src/compiler/manifest/emit.js";
import { generateOpenAPI } from "../../src/compiler/schema/openapi.js";

const fixtureRoot = resolve(__dirname, "../fixtures/posts");
const projectRoot = resolve(__dirname, "../..");

beforeAll(() => {
  execSync("npx tsc -p tsconfig.json", { cwd: fixtureRoot, stdio: "inherit" });
});

describe("Express Query Object Integration", () => {
  it("should bind flat query object into handler", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { PostController } = mod;

    const { createExpressRouter } = await import("../../dist/express.js");

    const tsconfigPath = resolve(fixtureRoot, "tsconfig.json");
    const { checker, sourceFiles } = createProgramFromConfig(tsconfigPath);
    const controllers = scanControllers(sourceFiles, checker);
    const manifest = generateManifest(controllers, checker, "0.1.0");
    const openapi = generateOpenAPI(controllers, checker);

    const app = express();
    app.use(express.json());
    app.use(await createExpressRouter({ controllers: [PostController], manifest, openapi }));

    const res = await request(app).get("/posts?status=published");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "published" });

    const deepRes = await request(app).get("/posts/search?where[responsavel][perfil][nome]=Admin");
    expect(deepRes.status).toBe(200);
    expect(deepRes.body).toEqual({ responsavel: { perfil: { nome: "Admin" } } });

    const tagsRes = await request(app).get("/posts/search?where[tags]=a&where[tags]=b");
    expect(tagsRes.status).toBe(200);
    expect(tagsRes.body).toEqual({ tags: ["a", "b"] });
  });
});
