import request from "supertest";
import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";

describe("include e2e", () => {
  it("?include=posts is accepted", async () => {
    const app = buildApp();
    await request(app).get("/users/1?include=posts").expect(200);
  });

  it("?include=hacker is rejected", async () => {
    const app = buildApp();
    const res = await request(app).get("/users/1?include=hacker").expect(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.issues[0].source).toBe("include");
  });
});