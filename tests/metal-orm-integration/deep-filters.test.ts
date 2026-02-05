import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createExpressApp } from "../../src";
import { AlphaController } from "../../examples/metal-orm-deep-filters/alpha.controller";
import {
  disposeDatabase,
  initializeDatabase
} from "../../examples/metal-orm-deep-filters/db";

describe("metal-orm deep filters", () => {
  let app: Awaited<ReturnType<typeof createExpressApp>>;

  beforeAll(async () => {
    await initializeDatabase();
    app = await createExpressApp({
      controllers: [AlphaController]
    });
  });

  afterAll(async () => {
    await disposeDatabase();
  });

  it("lists all alphas", async () => {
    const response = await request(app)
      .get("/alphas")
      .expect(200);

    expect(response.body.totalItems).toBe(2);
    expect(response.body.items).toHaveLength(2);
    const ids = response.body.items.map((item: { id: number }) => item.id);
    const sortedIds = [...ids].sort((a, b) => a - b);
    expect(ids).toEqual(sortedIds);
    for (const item of response.body.items) {
      expect(item.id).toEqual(expect.any(Number));
      expect(item.name).toEqual(expect.any(String));
      expect(item.bravos).toBeInstanceOf(Array);
      for (const bravo of item.bravos) {
        expect(bravo.alphaId).toEqual(item.id);
        expect(bravo.id).toEqual(expect.any(Number));
        expect(bravo.code).toEqual(expect.any(String));
        expect(bravo.charlies).toBeInstanceOf(Array);
        for (const charlie of bravo.charlies) {
          expect(charlie.bravoId).toBe(bravo.id);
          expect(charlie.id).toEqual(expect.any(Number));
          expect(charlie.score).toEqual(expect.any(Number));
          expect(charlie.bravoId).toEqual(expect.any(Number));
          if (charlie.delta !== null && charlie.delta !== undefined) {
            expect(charlie.deltaId).toEqual(expect.any(Number));
            expect(charlie.deltaId).toBe(charlie.delta.id);
            expect(charlie.delta.id).toEqual(expect.any(Number));
            expect(charlie.delta.name).toEqual(expect.any(String));
          } else {
            expect(charlie.deltaId === null || charlie.deltaId === undefined).toBe(true);
          }
        }
      }
    }
  });

  it("filters by deep delta name", async () => {
    const response = await request(app)
      .get("/alphas")
      .query({ deltaNameContains: "Core" });

    if (response.status !== 200) {
      throw new Error(
        `Expected 200 from /alphas?deltaNameContains=Core, got ${response.status}: ${response.text}`
      );
    }

    const names = response.body.items.map((item: { name: string }) => item.name).sort();
    expect(names).toEqual(["Alpha One", "Alpha Two"]);
    const deltas = response.body.items
      .flatMap((item: any) => item.bravos)
      .flatMap((bravo: any) => bravo.charlies)
      .map((charlie: any) => charlie.delta)
      .filter((delta: any) => delta);
    expect(deltas.some((delta: any) => delta.name === "Delta Core")).toBe(true);
  });

  it("filters by deep score", async () => {
    const response = await request(app)
      .get("/alphas")
      .query({ charlieScoreGte: 90 })
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].name).toBe("Alpha One");
    const scores = response.body.items[0].bravos
      .flatMap((bravo: any) => bravo.charlies)
      .map((charlie: any) => charlie.score);
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(90);
  });

  it("filters missing delta relations", async () => {
    const response = await request(app)
      .get("/alphas")
      .query({ deltaMissing: true })
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].name).toBe("Alpha One");
    const missing = response.body.items[0].bravos
      .flatMap((bravo: any) => bravo.charlies)
      .some((charlie: any) => charlie.delta === null);
    expect(missing).toBe(true);
  });
});
