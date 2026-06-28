import { describe, expect, it } from "vitest";
import {
  buildOpenApi,
  Controller,
  Doc,
  Get,
  Http,
  QueryMethod,
  QueryString,
  Returns,
  Streaming,
  t,
  type RequestContext
} from "../../src";
import { registerController } from "../../src/core/metadata";

describe("OpenAPI 3.2 generation", () => {
  it("emits OpenAPI 3.2 document metadata and reusable components", () => {
    @Controller("/oas32-meta")
    class Oas32MetaController {
      @Get("/")
      @Returns({
        status: 200,
        summary: "Listed",
        schema: t.object({ ok: t.boolean() }),
        examples: {
          success: {
            summary: "Success",
            dataValue: { ok: true },
            serializedValue: "{\"ok\":true}"
          }
        }
      })
      list() {
        return { ok: true };
      }
    }

    const doc = buildOpenApi({
      info: { title: "OAS 3.2", version: "1.0.0" },
      $self: "https://api.example.com/openapi.json",
      servers: [{ name: "prod", url: "https://api.example.com" }],
      tags: [{ name: "Reports", summary: "Reports", parent: "Operations", kind: "nav" }],
      components: {
        mediaTypes: {
          JsonLine: {
            schema: { type: "object" }
          }
        },
        securitySchemes: {
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "x-api-key"
          }
        }
      },
      controllers: [Oas32MetaController]
    });

    expect(doc.openapi).toBe("3.2.0");
    expect(doc.jsonSchemaDialect).toBe("https://spec.openapis.org/oas/3.1/dialect/base");
    expect(doc.$self).toBe("https://api.example.com/openapi.json");
    expect(doc.servers?.[0]).toEqual({ name: "prod", url: "https://api.example.com" });
    expect(doc.tags?.[0]).toEqual({ name: "Reports", summary: "Reports", parent: "Operations", kind: "nav" });
    expect(doc.components.mediaTypes?.JsonLine).toEqual({ schema: { type: "object" } });
    expect(doc.components.securitySchemes?.apiKey).toEqual({
      type: "apiKey",
      in: "header",
      name: "x-api-key"
    });

    const response = (doc.paths["/oas32-meta"] as any).get.responses["200"];
    expect(response.summary).toBe("Listed");
    expect(response.content["application/json"].examples.success).toEqual({
      summary: "Success",
      dataValue: { ok: true },
      serializedValue: "{\"ok\":true}"
    });
  });

  it("emits query as a fixed operation and custom methods under additionalOperations", () => {
    @Controller("/oas32-methods")
    class Oas32MethodsController {
      @QueryMethod("/")
      query() {
        return { ok: true };
      }

      @Http("LINK", "/")
      link() {
        return { ok: true };
      }
    }

    const doc = buildOpenApi({
      info: { title: "Methods", version: "1.0.0" },
      controllers: [Oas32MethodsController]
    });

    const pathItem = doc.paths["/oas32-methods"] as any;
    expect(pathItem.query.operationId).toBe("Oas32MethodsController.query");
    expect(pathItem.additionalOperations.LINK.operationId).toBe("Oas32MethodsController.link");
  });

  it("emits querystring parameters with content", () => {
    @Controller("/oas32-querystring")
    class Oas32QueryStringController {
      @Get("/")
      @QueryString(t.object({ q: t.string(), page: t.optional(t.integer()) }))
      search(_ctx: RequestContext) {
        return { ok: true };
      }
    }

    const doc = buildOpenApi({
      info: { title: "QueryString", version: "1.0.0" },
      controllers: [Oas32QueryStringController]
    });

    const params = (doc.paths["/oas32-querystring"] as any).get.parameters;
    expect(params).toEqual([
      {
        name: "querystring",
        in: "querystring",
        required: false,
        content: {
          "application/x-www-form-urlencoded": {
            schema: {
              type: "object",
              properties: {
                q: { type: "string" },
                page: { type: "integer" }
              },
              additionalProperties: false
            }
          }
        }
      }
    ]);
  });

  it("emits itemSchema for streaming media types", () => {
    @Controller("/oas32-streams")
    class Oas32StreamsController {
      @Get("/events")
      @Streaming({
        contentType: "application/x-ndjson",
        itemSchema: t.object({ id: t.integer() })
      })
      events() {
        return undefined;
      }
    }

    const doc = buildOpenApi({
      info: { title: "Streams", version: "1.0.0" },
      controllers: [Oas32StreamsController]
    });

    const mediaType = (doc.paths["/oas32-streams/events"] as any).get.responses["200"].content["application/x-ndjson"];
    expect(mediaType.itemSchema).toEqual({
      type: "object",
      properties: { id: { type: "integer" } },
      additionalProperties: false
    });
    expect(mediaType.schema).toEqual({
      type: "array",
      items: mediaType.itemSchema
    });
  });

  it("rejects routes that use both query and querystring inputs", () => {
    class InvalidQueryController {}

    registerController({
      basePath: "/invalid-query",
      controller: InvalidQueryController,
      routes: [
        {
          httpMethod: "get",
          path: "/",
          handlerName: "search",
          query: { schema: t.object({ q: t.string() }) },
          querystring: { schema: t.object({ q: t.string() }) },
          responses: [{ status: 200 }]
        }
      ]
    });

    expect(() =>
      buildOpenApi({
        info: { title: "Invalid", version: "1.0.0" },
        controllers: [InvalidQueryController]
      })
    ).toThrow("cannot use both @Query and @QueryString");
  });

  it("merges operation and schema escape hatches", () => {
    @Controller("/oas32-escape")
    class Oas32EscapeController {
      @Get("/")
      @Doc({ operation: { deprecated: true, "x-adorn": "yes" } })
      @Returns(t.object({
        value: t.string({
          xml: { nodeType: "attribute" },
          discriminator: { defaultMapping: "#/components/schemas/Fallback" },
          openApi: { "x-schema": "custom" }
        })
      }))
      read() {
        return { value: "ok" };
      }
    }

    const doc = buildOpenApi({
      info: { title: "Escape", version: "1.0.0" },
      controllers: [Oas32EscapeController]
    });

    const operation = (doc.paths["/oas32-escape"] as any).get;
    expect(operation.deprecated).toBe(true);
    expect(operation["x-adorn"]).toBe("yes");
    const valueSchema = operation.responses["200"].content["application/json"].schema.properties.value;
    expect(valueSchema.xml).toEqual({ nodeType: "attribute" });
    expect(valueSchema.discriminator).toEqual({ defaultMapping: "#/components/schemas/Fallback" });
    expect(valueSchema["x-schema"]).toBe("custom");
  });
});
