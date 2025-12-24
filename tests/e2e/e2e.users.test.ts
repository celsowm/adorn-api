import request from "supertest";
import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";

describe("users e2e", () => {
  it("GET /users/123 coerces id to number", async () => {
    const app = buildApp();
    const res = await request(app).get("/users/123").expect(200);
    expect(res.body).toEqual({ id: 123, name: "alice" });
  });

  it("POST /users validates body + response", async () => {
    const app = buildApp();
    const res = await request(app).post("/users").send({ name: "bob" }).expect(200);
    expect(res.body).toEqual({ id: 1, name: "bob" });
  });
});