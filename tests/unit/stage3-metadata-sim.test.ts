import { describe, it, expect, vi } from "vitest";
import { Controller, Dto, Field, Get, Params } from "../../src/core/decorators";
import { t } from "../../src/core/schema";
import { getControllerMeta, getDtoMeta } from "../../src/core/metadata";

function withSymbolMetadata<T>(value: symbol | undefined, fn: () => T): T {
  const hasOwn = Object.prototype.hasOwnProperty.call(Symbol, "metadata");
  const original = (Symbol as { metadata?: symbol }).metadata;
  if (value === undefined) {
    // Simulate runtimes without Symbol.metadata.
    try {
      delete (Symbol as { metadata?: symbol }).metadata;
    } catch {
      (Symbol as { metadata?: symbol }).metadata = undefined;
    }
  } else {
    (Symbol as { metadata?: symbol }).metadata = value;
  }

  try {
    return fn();
  } finally {
    if (hasOwn) {
      (Symbol as { metadata?: symbol }).metadata = original;
    } else {
      delete (Symbol as { metadata?: symbol }).metadata;
    }
  }
}

describe("Stage 3 decorator metadata (simulation)", () => {
  it("keeps route/DTO metadata when Symbol.metadata exists", () => {
    withSymbolMetadata(Symbol("Symbol.metadata"), () => {
      @Dto()
      class ParamsDto {
        @Field(t.string())
        id!: string;
      }

      @Controller("/items")
      class ItemsController {
        @Get("/:id")
        @Params(ParamsDto)
        getOne() {}
      }

      const dtoMeta = getDtoMeta(ParamsDto);
      expect(dtoMeta?.fields.id).toBeDefined();

      const controllerMeta = getControllerMeta(ItemsController);
      expect(controllerMeta?.routes.length).toBe(1);
      expect(controllerMeta?.routes[0].params?.schema).toBe(ParamsDto);
    });
  });

  it("polyfills Symbol.metadata to keep metadata when missing", async () => {
    const hasOwn = Object.prototype.hasOwnProperty.call(Symbol, "metadata");
    const original = (Symbol as { metadata?: symbol }).metadata;
    try {
      try {
        delete (Symbol as { metadata?: symbol }).metadata;
      } catch {
        (Symbol as { metadata?: symbol }).metadata = undefined;
      }

      vi.resetModules();
      const decorators = await import("../../src/core/decorators");
      const metadata = await import("../../src/core/metadata");
      const schema = await import("../../src/core/schema");

      const { Controller, Dto, Field, Get, Params } = decorators;
      const { t } = schema;

      @Dto()
      class ParamsDto {
        @Field(t.string())
        id!: string;
      }

      @Controller("/items")
      class ItemsController {
        @Get("/:id")
        @Params(ParamsDto)
        getOne() {}
      }

      const dtoMeta = metadata.getDtoMeta(ParamsDto);
      expect(dtoMeta?.fields.id).toBeDefined();

      const controllerMeta = metadata.getControllerMeta(ItemsController);
      expect(controllerMeta?.routes.length).toBe(1);
      expect(controllerMeta?.routes[0].params?.schema).toBe(ParamsDto);
    } finally {
      if (hasOwn) {
        (Symbol as { metadata?: symbol }).metadata = original;
      } else {
        delete (Symbol as { metadata?: symbol }).metadata;
      }
    }
  });

  it("drops metadata when decorator contexts do not share metadata objects (simulated claim)", () => {
    class ParamsDto {
      id!: string;
    }

    class ItemsController {
      getOne() {}
    }

    const fieldDecorator = Field(t.string());
    const dtoDecorator = Dto();
    const paramsDecorator = Params(ParamsDto);
    const getDecorator = Get("/:id");
    const controllerDecorator = Controller("/items");

    // Each decorator receives a fresh metadata object, simulating a broken Stage 3 pipeline.
    fieldDecorator(undefined, { name: "id", metadata: {} } as ClassFieldDecoratorContext);
    dtoDecorator(ParamsDto, { metadata: {} } as ClassDecoratorContext);

    getDecorator(ItemsController.prototype.getOne, {
      name: "getOne",
      metadata: {}
    } as ClassMethodDecoratorContext);
    paramsDecorator(ItemsController.prototype.getOne, {
      name: "getOne",
      metadata: {}
    } as ClassMethodDecoratorContext);

    controllerDecorator(ItemsController, { metadata: {} } as ClassDecoratorContext);

    const dtoMeta = getDtoMeta(ParamsDto);
    expect(dtoMeta?.fields.id).toBeUndefined();

    const controllerMeta = getControllerMeta(ItemsController);
    expect(controllerMeta?.routes.length).toBe(0);
  });
});
