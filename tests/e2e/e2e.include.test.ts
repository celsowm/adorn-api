import request from "supertest";
import { describe, it, expect } from "vitest";
import { buildTestApp } from "./app.js";

describe("include e2e", () => {
  it("?include=posts is accepted", async () => {
    const app = buildTestApp();
    await request(app).get("/users/1?include=posts").expect(200);
  });

  it("?include=posts.comments.author is accepted within maxDepth=2? (should be rejected)", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/users/1?include=posts.comments.author").expect(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.issues[0].source).toBe("include");
  });

  it("?include=hacker is rejected", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/users/1?include=hacker").expect(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.issues[0].source).toBe("include");
  });
});
