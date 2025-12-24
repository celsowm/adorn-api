import request from "supertest";
import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";

describe("validation e2e", () => {
  it("invalid params returns 400 ValidationError shape", async () => {
    const app = buildApp();
    const res = await request(app).get("/users/abc").expect(400);

    expect(res.body.error).toBe("ValidationError");
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.issues[0].source).toBe("params");
  });

  it("invalid body returns 400", async () => {
    const app = buildApp();
    const res = await request(app).post("/users").send({}).expect(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.issues[0].source).toBe("body");
  });
});