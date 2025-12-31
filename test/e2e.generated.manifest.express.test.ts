import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import express from "express";
import request from "supertest";

const fixtureRoot = resolve(__dirname, "fixtures/users");
const artifactsDir = resolve(fixtureRoot, ".adorn");
const projectRoot = resolve(__dirname, "..");

beforeAll(() => {
  execSync("npm run build", { cwd: projectRoot, stdio: "inherit" });
  execSync("npx tsc -p tsconfig.json", { cwd: fixtureRoot, stdio: "inherit" });
  execSync(`npx tsx "${resolve(projectRoot, "src/cli.ts")}" build -p tsconfig.json --output .adorn`, {
    cwd: fixtureRoot,
    stdio: "inherit",
  });
});

describe("E2E - Generated Manifest with Express", () => {
  it("should serve GET /users/ using generated manifest", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { UserController } = mod;

    const { createExpressRouter } = await import("../dist/express.js");

    const app = express();
    app.use(express.json());
    app.use(await createExpressRouter({ controllers: [UserController], artifactsDir }));

    const res = await request(app).get("/users/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Alan Turing");
    expect(res.body[0].role).toBe("admin");
  });

  it("should serve POST /users/ using generated manifest", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { UserController } = mod;

    const { createExpressRouter } = await import("../dist/express.js");

    const app = express();
    app.use(express.json());
    app.use(await createExpressRouter({ controllers: [UserController], artifactsDir }));

    const newUser = { name: "Grace Hopper", phone: "+1 555 123" };
    const res = await request(app).post("/users/").send(newUser);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(newUser.name);
    expect(res.body.phone).toBe(newUser.phone);
    expect(res.body.role).toBe("user");
    expect(res.body.id).toBe(2);
  });

  it("should serve GET /users/:id with path params using generated manifest", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { UserController } = mod;

    const { createExpressRouter } = await import("../dist/express.js");

    const app = express();
    app.use(express.json());
    app.use(await createExpressRouter({ controllers: [UserController], artifactsDir }));

    const res = await request(app).get("/users/1");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.name).toBe("Alan Turing");
  });

  it("should serve GET /users/:id with query params using generated manifest", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { UserController } = mod;

    const { createExpressRouter } = await import("../dist/express.js");

    const app = express();
    app.use(express.json());
    app.use(await createExpressRouter({ controllers: [UserController], artifactsDir }));

    const res = await request(app).get("/users/1?verbose=true");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.name).toBe("Alan Turing");
  });

  it("should serve POST and GET requests using generated manifest", async () => {
    const controllerPath = resolve(fixtureRoot, "dist/controller.js");
    const mod = await import(pathToFileURL(controllerPath).href);
    const { UserController } = mod;

    const { createExpressRouter } = await import("../dist/express.js");

    const app = express();
    app.use(express.json());
    app.use(await createExpressRouter({ controllers: [UserController], artifactsDir }));

    const res1 = await request(app).post("/users/").send({ name: "Test User", phone: "123" });
    expect(res1.status).toBe(201);
    expect(res1.body.name).toBe("Test User");
    expect(res1.body.id).toBeDefined();

    const res2 = await request(app).get("/users/");
    expect(res2.status).toBe(200);
    expect(res2.body.some((u: any) => u.name === "Test User")).toBe(true);
  });
});
