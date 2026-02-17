import { describe, expect, it, beforeEach } from "vitest";
import { t } from "../../src/core/schema";
import { registerController, registerDto } from "../../src/core/metadata";
import { buildOpenApi } from "../../src/core/openapi";
import { createInputCoercer } from "../../src/adapter/express/coercion";

describe("OpenAPI query parameter serialization", () => {
  class QueryArrayController {}

  beforeEach(() => {
    registerController({
      basePath: "/items",
      controller: QueryArrayController,
      routes: [
        {
          httpMethod: "get",
          path: "/",
          handlerName: "list",
          query: {
            schema: {
              kind: "object",
              properties: {
                ids: t.array(t.string()),
                nums: t.array(t.integer()),
                tags: t.array(t.string(), { examples: [["a", "b"]] })
              }
            }
          },
          responses: [{ status: 200 }]
        }
      ]
    });
  });

  it("query array<string> generates style=form + explode=true", () => {
    const doc = buildOpenApi({
      info: { title: "test", version: "1.0.0" },
      controllers: [QueryArrayController]
    });

    const params = (doc.paths["/items"] as any).get.parameters as any[];
    const idsParam = params.find((p: any) => p.name === "ids");

    expect(idsParam).toBeDefined();
    expect(idsParam.style).toBe("form");
    expect(idsParam.explode).toBe(true);
  });

  it("query array<integer> generates style=form + explode=true", () => {
    const doc = buildOpenApi({
      info: { title: "test", version: "1.0.0" },
      controllers: [QueryArrayController]
    });

    const params = (doc.paths["/items"] as any).get.parameters as any[];
    const numsParam = params.find((p: any) => p.name === "nums");

    expect(numsParam).toBeDefined();
    expect(numsParam.style).toBe("form");
    expect(numsParam.explode).toBe(true);
  });

  it("projects example from schema.examples to parameter.example", () => {
    const doc = buildOpenApi({
      info: { title: "test", version: "1.0.0" },
      controllers: [QueryArrayController]
    });

    const params = (doc.paths["/items"] as any).get.parameters as any[];
    const tagsParam = params.find((p: any) => p.name === "tags");

    expect(tagsParam).toBeDefined();
    expect(tagsParam.example).toEqual(["a", "b"]);
  });
});

describe("Query array coercion – CSV support", () => {
  it("?ids=1&ids=2 -> [1,2] via repeated keys", () => {
    const coerce = createInputCoercer(
      { schema: { kind: "object", properties: { ids: t.array(t.integer()) } } },
      { mode: "safe", location: "query" }
    )!;

    const result = coerce({ ids: ["1", "2"] });
    expect(result.ids).toEqual([1, 2]);
  });

  it("?ids=1,2 -> [1,2] via CSV string", () => {
    const coerce = createInputCoercer(
      { schema: { kind: "object", properties: { ids: t.array(t.integer()) } } },
      { mode: "safe", location: "query" }
    )!;

    const result = coerce({ ids: "1,2" });
    expect(result.ids).toEqual([1, 2]);
  });
});
