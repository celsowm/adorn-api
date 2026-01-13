import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import {
  Controller,
  Get,
  Post,
  ExpressAdapter,
  OpenApiGenerator,
  List,
} from "../../src/index.js";

describe("Integration: @List Decorator with Metal-ORM", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    app = null as any;
  });

  it("should generate OpenAPI schema for @List decorator", () => {
    @Controller("/users")
    class UserController {
      @List()
      async getAll() {
        return [];
      }
    }

    const generator = new OpenApiGenerator();
    const spec = generator.generateDocument({
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths).toBeDefined();
    expect(spec.paths!["/users"]).toBeDefined();
    expect(spec.paths!["/users"].get).toBeDefined();

    const operation = spec.paths!["/users"].get;
    expect(operation.responses).toBeDefined();
    expect(operation.responses["200"]).toBeDefined();
  });

  it("should handle @List with entity option", () => {
    @Controller("/posts")
    class PostController {
      @List({ entity: {} })
      async getAll() {
        return [];
      }
    }

    const generator = new OpenApiGenerator();
    const spec = generator.generateDocument({
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // Entity exists, so route should be registered
    expect(spec.paths!["/posts"]).toBeDefined();
    expect(spec.paths!["/posts"].get).toBeDefined();
    expect(spec.paths!["/posts"].get.responses["200"]).toBeDefined();
  });

  it("should handle @List with path option", () => {
    @Controller("/api")
    class ProductController {
      @List("/products")
      async getAll() {
        return [];
      }
    }

    const generator = new OpenApiGenerator();
    const spec = generator.generateDocument({
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    expect(spec.paths!["/api/products"]).toBeDefined();
  });

  it("should work with @Get for single item", () => {
    @Controller("/users")
    class UserController {
      @List()
      async getAll() {
        return [];
      }

      @Get("/:id")
      async getById() {
        return { id: "1", name: "Test" };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(UserController);

    const generator = new OpenApiGenerator();
    const spec = generator.generateDocument({
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    expect(spec.paths!["/users"]).toBeDefined();
    expect(spec.paths!["/users"].get).toBeDefined();
    expect(spec.paths!["/users/{id}"]).toBeDefined();
    expect(spec.paths!["/users/{id}"].get).toBeDefined();
  });

  it("should handle mixed decorators", () => {
    @Controller("/users")
    class UserController {
      @List()
      async getAll() {
        return [];
      }

      @Get("/:id")
      async getById() {
        return null;
      }

      @Post()
      async create() {
        return null;
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(UserController);

    const generator = new OpenApiGenerator();
    const spec = generator.generateDocument({
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    expect(spec.paths!["/users"].get).toBeDefined();
    expect(spec.paths!["/users"].post).toBeDefined();
    expect(spec.paths!["/users/{id}"].get).toBeDefined();
  });
});
