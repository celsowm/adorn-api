import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

import { loadConfig } from "../../src/config/loadConfig";
import { generateRoutes } from "../../src/codegen/generateRoutes";
import { generateOpenapi } from "../../src/openapi/generateOpenapi";

async function mkTmpProjectDir(): Promise<string> {
  const root = process.cwd();
  const base = path.join(root, ".vitest-tmp");
  await fs.mkdir(base, { recursive: true });
  return fs.mkdtemp(path.join(base, "adorn-e2e-swagger-"));
}

async function writeFile(p: string, content: string) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
}

describe("E2E: Swagger/OpenAPI Compliance", () => {
  it("generates valid OpenAPI 3.1.0 specification", async () => {
    const dir = await mkTmpProjectDir();

    try {
      await writeFile(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              skipLibCheck: true
            },
            include: ["src/**/*.ts"]
          },
          null,
          2
        )
      );

      await writeFile(
        path.join(dir, "adorn.config.ts"),
        `
import { defineConfig } from "adorn-api/config";

export default defineConfig({
  generation: {
    rootDir: ${JSON.stringify(dir)},
    tsConfigPath: "./tsconfig.json",
    controllers: { include: ["src/controllers/**/*.controller.ts"] },
    basePath: "/api",
    framework: "express",
    outputs: {
      routes: "src/generated/routes.ts",
      openapi: "src/generated/openapi.json"
    },
    inference: {
      inferPathParamsFromTemplate: true,
      defaultDtoFieldSource: "smart",
      collisionPolicy: "path-wins"
    }
  },
  swagger: {
    enabled: true,
    info: {
      title: "Swagger Compliance API",
      version: "2.0.0",
      description: "API for testing OpenAPI compliance"
    }
  }
});
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/users.controller.ts"),
        `
import { Controller, Get, Post, Put, Delete, Status } from "adorn-api/decorators";

class GetUserDto {
  id!: string;
}

class CreateUserDto {
  name!: string;
  email!: string;
}

class UpdateUserDto {
  name?: string;
  email?: string;
}

@Controller("users")
export class UsersController {
  @Get("{id}")
  async getUser(dto: GetUserDto) {
    return { id: dto.id, name: "Test User" };
  }

  @Status(201)
  @Post("/")
  async createUser(dto: CreateUserDto) {
    return { id: "new-id", name: dto.name, email: dto.email };
  }

  @Put("{id}")
  async updateUser(dto: UpdateUserDto) {
    return { id: dto.id || "123", ...dto };
  }

  @Delete("{id}")
  async deleteUser(dto: GetUserDto) {
    return { success: true };
  }
}
`.trim()
      );

      const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });
      await generateRoutes(config);
      await generateOpenapi(config);

      const openapiFile = path.join(dir, "src/generated/openapi.json");
      const openapiRaw = await fs.readFile(openapiFile, "utf8");
      const openapi = JSON.parse(openapiRaw);

      // Validate OpenAPI 3.1.0 structure
      expect(openapi.openapi).toBe("3.1.0");
      expect(openapi.info).toBeDefined();
      expect(openapi.info.title).toBe("Swagger Compliance API");
      expect(openapi.info.version).toBe("2.0.0");
      expect(openapi.info.description).toBe("API for testing OpenAPI compliance");
      expect(openapi.paths).toBeDefined();
      expect(openapi.paths).toBeInstanceOf(Object);

      // Validate paths exist
      expect(openapi.paths["/api/users/{id}"]).toBeDefined();
      expect(openapi.paths["/api/users"]).toBeDefined();

      // Validate GET /users/{id}
      const getUser = openapi.paths["/api/users/{id}"].get;
      expect(getUser).toBeDefined();
      expect(getUser.operationId).toBe("userscontroller_getUser");
      expect(getUser.responses).toBeDefined();
      expect(getUser.responses[200]).toBeDefined();
      expect(getUser.responses[200].description).toBe("Success");
      expect(getUser.responses[200].content).toBeDefined();
      expect(getUser.responses[200].content["application/json"]).toBeDefined();
      
      // Validate path parameters
      expect(getUser.parameters).toBeDefined();
      expect(getUser.parameters).toHaveLength(1);
      expect(getUser.parameters[0]).toMatchObject({
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" }
      });

      // Validate POST /users
      const createUser = openapi.paths["/api/users"].post;
      expect(createUser).toBeDefined();
      expect(createUser.operationId).toBe("userscontroller_createUser");
      expect(createUser.responses).toBeDefined();
      expect(createUser.responses[201]).toBeDefined();
      expect(createUser.responses[201].description).toBe("Success");
      
      // Validate request body for POST
      expect(createUser.requestBody).toBeDefined();
      expect(createUser.requestBody.required).toBe(true);
      expect(createUser.requestBody.content).toBeDefined();
      expect(createUser.requestBody.content["application/json"]).toBeDefined();
      expect(createUser.requestBody.content["application/json"].schema).toBeDefined();
      expect(createUser.requestBody.content["application/json"].schema.$ref).toBe("#/components/schemas/CreateUserDto");

      // Validate PUT /users/{id}
      const updateUser = openapi.paths["/api/users/{id}"].put;
      expect(updateUser).toBeDefined();
      expect(updateUser.operationId).toBe("userscontroller_updateUser");
      expect(updateUser.responses).toBeDefined();
      expect(updateUser.responses[200]).toBeDefined();
      
      // Validate request body for PUT
      expect(updateUser.requestBody).toBeDefined();
      expect(updateUser.requestBody.content["application/json"].schema.$ref).toBe("#/components/schemas/UpdateUserDto");
      
      // Validate path parameters for PUT
      expect(updateUser.parameters).toBeDefined();
      expect(updateUser.parameters).toHaveLength(1);
      expect(updateUser.parameters[0].name).toBe("id");

      // Validate DELETE /users/{id}
      const deleteUser = openapi.paths["/api/users/{id}"].delete;
      expect(deleteUser).toBeDefined();
      expect(deleteUser.operationId).toBe("userscontroller_deleteUser");
      expect(deleteUser.responses).toBeDefined();
      expect(deleteUser.responses[200]).toBeDefined();

      // Validate file is valid JSON
      expect(() => JSON.parse(openapiRaw)).not.toThrow();

    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("generates valid OpenAPI spec with multiple controllers", async () => {
    const dir = await mkTmpProjectDir();

    try {
      await writeFile(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              skipLibCheck: true
            },
            include: ["src/**/*.ts"]
          },
          null,
          2
        )
      );

      await writeFile(
        path.join(dir, "adorn.config.ts"),
        `
import { defineConfig } from "adorn-api/config";

export default defineConfig({
  generation: {
    rootDir: ${JSON.stringify(dir)},
    tsConfigPath: "./tsconfig.json",
    controllers: { include: ["src/controllers/**/*.controller.ts"] },
    basePath: "/api",
    framework: "express",
    outputs: {
      routes: "src/generated/routes.ts",
      openapi: "src/generated/openapi.json"
    },
    inference: {
      inferPathParamsFromTemplate: true,
      defaultDtoFieldSource: "smart",
      collisionPolicy: "path-wins"
    }
  },
  swagger: {
    enabled: true,
    info: { title: "Multi Controller API", version: "1.0.0" }
  }
});
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/products.controller.ts"),
        `
import { Controller, Get } from "adorn-api/decorators";

class GetProductDto {
  id!: string;
}

@Controller("products")
export class ProductsController {
  @Get("{id}")
  async getProduct(dto: GetProductDto) {
    return { id: dto.id };
  }
}
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/orders.controller.ts"),
        `
import { Controller, Get, Post } from "adorn-api/decorators";

class GetOrderDto {
  id!: string;
}

class CreateOrderDto {
  productId!: string;
  quantity!: number;
}

@Controller("orders")
export class OrdersController {
  @Get("{id}")
  async getOrder(dto: GetOrderDto) {
    return { id: dto.id };
  }

  @Post("/")
  async createOrder(dto: CreateOrderDto) {
    return { id: "new-order", ...dto };
  }
}
`.trim()
      );

      const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });
      await generateRoutes(config);
      await generateOpenapi(config);

      const openapiFile = path.join(dir, "src/generated/openapi.json");
      const openapiRaw = await fs.readFile(openapiFile, "utf8");
      const openapi = JSON.parse(openapiRaw);

      // Validate multiple paths from different controllers
      expect(openapi.paths["/api/products/{id}"]).toBeDefined();
      expect(openapi.paths["/api/orders/{id}"]).toBeDefined();
      expect(openapi.paths["/api/orders"]).toBeDefined();

      // Validate operation IDs are unique per controller
      const operationIds: string[] = [];
      for (const pathKey in openapi.paths) {
        const pathObj = openapi.paths[pathKey] as Record<string, any>;
        for (const methodKey in pathObj) {
          const method = pathObj[methodKey];
          if (method && method.operationId) {
            operationIds.push(method.operationId);
          }
        }
      }
      
      expect(operationIds).toHaveLength(3);
      expect(new Set(operationIds).size).toBe(3);

      // Validate each operation has proper structure
      for (const pathKey in openapi.paths) {
        const pathObj = openapi.paths[pathKey] as Record<string, any>;
        for (const methodKey in pathObj) {
          const method = pathObj[methodKey];
          expect(method.operationId).toBeDefined();
          expect(method.responses).toBeDefined();
          expect(method.responses).toBeInstanceOf(Object);
        }
      }

    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("generates OpenAPI spec compliant with all HTTP methods", async () => {
    const dir = await mkTmpProjectDir();

    try {
      await writeFile(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              skipLibCheck: true
            },
            include: ["src/**/*.ts"]
          },
          null,
          2
        )
      );

      await writeFile(
        path.join(dir, "adorn.config.ts"),
        `
import { defineConfig } from "adorn-api/config";

export default defineConfig({
  generation: {
    rootDir: ${JSON.stringify(dir)},
    tsConfigPath: "./tsconfig.json",
    controllers: { include: ["src/controllers/**/*.controller.ts"] },
    basePath: "/api",
    framework: "express",
    outputs: {
      routes: "src/generated/routes.ts",
      openapi: "src/generated/openapi.json"
    },
    inference: {
      inferPathParamsFromTemplate: true,
      defaultDtoFieldSource: "smart",
      collisionPolicy: "path-wins"
    }
  },
  swagger: {
    enabled: true,
    info: { title: "HTTP Methods API", version: "1.0.0" }
  }
});
`.trim()
      );

      await writeFile(
        path.join(dir, "src/controllers/resources.controller.ts"),
        `
import { Controller, Get, Post, Put, Patch, Delete, Head, Options } from "adorn-api/decorators";

class ResourceDto {
  id!: string;
  data?: string;
}

class CreateResourceDto {
  name!: string;
}

@Controller("resources")
export class ResourcesController {
  @Get("{id}")
  async getResource(dto: ResourceDto) {
    return { id: dto.id };
  }

  @Get("/")
  async listResources() {
    return { resources: [] };
  }

  @Post("/")
  async createResource(dto: CreateResourceDto) {
    return { id: "new", ...dto };
  }

  @Put("{id}")
  async putResource(dto: ResourceDto) {
    return { id: dto.id, ...dto };
  }

  @Patch("{id}")
  async patchResource(dto: ResourceDto) {
    return { id: dto.id, patched: true };
  }

  @Delete("{id}")
  async deleteResource(dto: ResourceDto) {
    return { deleted: dto.id };
  }

  @Head("/")
  async headResource() {
    return;
  }

  @Options("/")
  async optionsResource() {
    return { methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] };
  }
}
`.trim()
      );

      const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });
      await generateRoutes(config);
      await generateOpenapi(config);

      const openapiFile = path.join(dir, "src/generated/openapi.json");
      const openapi = JSON.parse(await fs.readFile(openapiFile, "utf8"));

      // Validate all HTTP methods are represented
      const resourcePath = openapi.paths["/api/resources"] as Record<string, any>;
      expect(resourcePath).toBeDefined();
      expect(resourcePath.get).toBeDefined();
      expect(resourcePath.post).toBeDefined();
      expect(resourcePath.head).toBeDefined();
      expect(resourcePath.options).toBeDefined();

      const resourceWithPath = openapi.paths["/api/resources/{id}"] as Record<string, any>;
      expect(resourceWithPath).toBeDefined();
      expect(resourceWithPath.get).toBeDefined();
      expect(resourceWithPath.put).toBeDefined();
      expect(resourceWithPath.patch).toBeDefined();
      expect(resourceWithPath.delete).toBeDefined();

      // Validate methods with body have requestBody
      const methodsWithBody = [resourcePath.post, resourceWithPath.put, resourceWithPath.patch];
      for (const method of methodsWithBody) {
        expect(method.requestBody).toBeDefined();
        expect(method.requestBody.required).toBe(true);
        expect(method.requestBody.content["application/json"]).toBeDefined();
      }

    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
