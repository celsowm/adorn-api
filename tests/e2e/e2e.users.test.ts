import request from "supertest";
import { describe, it, expect } from "vitest";
import { buildTestApp } from "./app.js";

describe("users e2e", () => {
  it("GET /users/123 coerces id to number", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/users/123").expect(200);
    expect(res.body).toEqual({ id: 123, name: "alice" });
  });

  it("GET /users/123?include=posts returns modified name", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/users/123?include=posts").expect(200);
    expect(res.body).toEqual({ id: 123, name: "alice+posts" });
  });

  it("POST /users validates body + response", async () => {
    const app = buildTestApp();
    const res = await request(app).post("/users").send({ name: "bob" }).expect(200);
    expect(res.body).toEqual({ id: 1, name: "bob" });
  });
});
