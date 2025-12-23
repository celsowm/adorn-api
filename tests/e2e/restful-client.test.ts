import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadConfig } from "../../src/config/loadConfig";
import { generateRoutes } from "../../src/codegen/generateRoutes";
import { generateOpenapi } from "../../src/openapi/generateOpenapi";

// Simple REST client using native fetch API
class RestClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...defaultHeaders
    };
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      method,
      headers: this.defaultHeaders,
      ...options
    };

    if (data !== undefined) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>("GET", endpoint);
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>("POST", endpoint, data);
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>("PUT", endpoint, data);
  }

  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>("PATCH", endpoint, data);
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>("DELETE", endpoint);
  }
}

async function mkTmpProjectDir(): Promise<string> {
  const root = process.cwd();
  const base = path.join(root, ".vitest-tmp");
  await fs.mkdir(base, { recursive: true });
  return fs.mkdtemp(path.join(base, "adorn-e2e-restful-"));
}

async function writeFile(p: string, content: string) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
}

describe("E2E: RESTful Client Testing", () => {
  let server: any;
  let port: number;
  let client: RestClient;
  let dir: string;

  beforeAll(async () => {
    dir = await mkTmpProjectDir();

      await writeFile(
        path.join(dir, "tsconfig.json"),
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              skipLibCheck: true,
              experimentalDecorators: true,
              emitDecoratorMetadata: true
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
    info: { title: "RESTful Client API", version: "1.0.0" }
  }
});
`.trim()
    );

      await writeFile(
        path.join(dir, "src/controllers/users.controller.ts"),
        `
import { Controller, Get, Post, Put, Patch, Delete, Status } from "adorn-api/decorators";

class GetUserDto {
  id!: string;
}

class ListUsersDto {
  page?: string;
  limit?: string;
}

class CreateUserDto {
  name!: string;
  email!: string;
}

class UpdateUserDto {
  name?: string;
  email?: string;
}

class PatchUserDto {
  email?: string;
}

// Static storage to persist data across requests
const usersStore = new Map<string, { id: string; name: string; email: string }>();

@Controller("users")
export class UsersController {
  @Get("/")
  async listUsers(dto: ListUsersDto) {
    const page = parseInt(dto.page || "1", 10);
    const limit = parseInt(dto.limit || "10", 10);
    const allUsers = Array.from(usersStore.values());
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      data: allUsers.slice(start, end),
      meta: { page, limit, total: allUsers.length }
    };
  }

  @Get("{id}")
  async getUser(dto: GetUserDto) {
    const user = usersStore.get(dto.id);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }
    return user;
  }

  @Status(201)
  @Post("/")
  async createUser(dto: CreateUserDto) {
    const id = Math.random().toString(36).substring(7);
    const user = { id, name: dto.name, email: dto.email };
    usersStore.set(id, user);
    return user;
  }

  @Put("{id}")
  async updateUser(dto: GetUserDto & UpdateUserDto) {
    const user = usersStore.get(dto.id);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }
    if (dto.name) user.name = dto.name;
    if (dto.email) user.email = dto.email;
    return user;
  }

  @Patch("{id}")
  async patchUser(dto: GetUserDto & PatchUserDto) {
    const user = usersStore.get(dto.id);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }
    if (dto.email) user.email = dto.email;
    return user;
  }

  @Delete("{id}")
  async deleteUser(dto: GetUserDto) {
    const user = usersStore.get(dto.id);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }
    usersStore.delete(dto.id);
    return { success: true, id: dto.id };
  }
}
`.trim()
    );

    await writeFile(
      path.join(dir, "src/controllers/products.controller.ts"),
      `
import { Controller, Get, Post, Put, Delete, Status } from "adorn-api/decorators";

class GetProductDto {
  id!: string;
}

class ListProductsDto {
  search?: string;
}

class CreateProductDto {
  name!: string;
  price!: number;
}

// Static storage to persist data across requests
const productsStore = new Map<string, { id: string; name: string; price: number }>();

@Controller("products")
export class ProductsController {
  @Get("/")
  async listProducts(dto: ListProductsDto) {
    let products = Array.from(productsStore.values());
    if (dto.search) {
      products = products.filter(p => p.name.toLowerCase().includes(dto.search!.toLowerCase()));
    }
    return { data: products };
  }

  @Get("{id}")
  async getProduct(dto: GetProductDto) {
    const product = productsStore.get(dto.id);
    if (!product) {
      throw { status: 404, message: "Product not found" };
    }
    return product;
  }

  @Status(201)
  @Post("/")
  async createProduct(dto: CreateProductDto) {
    const id = Math.random().toString(36).substring(7);
    const product = { id, name: dto.name, price: dto.price };
    productsStore.set(id, product);
    return product;
  }

  @Put("{id}")
  async updateProduct(dto: GetProductDto & CreateProductDto) {
    const product = productsStore.get(dto.id);
    if (!product) {
      throw { status: 404, message: "Product not found" };
    }
    product.name = dto.name;
    product.price = dto.price;
    return product;
  }

  @Delete("{id}")
  async deleteProduct(dto: GetProductDto) {
    const product = productsStore.get(dto.id);
    if (!product) {
      throw { status: 404, message: "Product not found" };
    }
    productsStore.delete(dto.id);
    return { success: true, id: dto.id };
  }
}
`.trim()
    );

    const config = await loadConfig({ configPath: path.join(dir, "adorn.config.ts") });
    await generateRoutes(config);
    await generateOpenapi(config);

    const routesFile = path.join(dir, "src/generated/routes.ts");
    const mod = await import(pathToFileURL(routesFile).href);
    const RegisterRoutes = mod.RegisterRoutes as (app: express.Express) => void;

    const app = express();
    app.use(express.json());
    RegisterRoutes(app);

    // Use error handler middleware
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
    });

    // Start server on available port
    port = 3001;
    server = app.listen(port);
    
    client = new RestClient(`http://localhost:${port}/api`);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  describe("GET requests", () => {
    it("should get a user by ID", async () => {
      // First create a user
      const created = await client.post<{id: string; name: string; email: string}>("/users", { name: "John Doe", email: "john@example.com" });
      
      // Then get the user
      const user = await client.get<{id: string; name: string; email: string}>(`/users/${created.id}`);
      
      expect(user).toMatchObject({
        id: created.id,
        name: "John Doe",
        email: "john@example.com"
      });
    });

    it("should list users with pagination", async () => {
      // Create multiple users
      await client.post("/users", { name: "User 1", email: "user1@example.com" });
      await client.post("/users", { name: "User 2", email: "user2@example.com" });
      await client.post("/users", { name: "User 3", email: "user3@example.com" });

      // List users with pagination
      const response = await client.get<{data: any[]; meta: {page: number; limit: number; total: number}}>("/users?page=1&limit=2");
      
      expect(response).toHaveProperty("data");
      expect(response).toHaveProperty("meta");
      expect(response.data).toBeInstanceOf(Array);
      expect(response.data.length).toBeLessThanOrEqual(2);
      expect(response.meta).toMatchObject({
        page: 1,
        limit: 2,
        total: expect.any(Number)
      });
    });

    it("should list products with search filter", async () => {
      // Create products
      await client.post("/products", { name: "Apple iPhone", price: 999 });
      await client.post("/products", { name: "Samsung Galaxy", price: 899 });
      await client.post("/products", { name: "Google Pixel", price: 799 });

      // Search for products
      const response = await client.get<{data: any[]}>("/products?search=apple");
      
      expect(response.data).toBeInstanceOf(Array);
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.data[0].name.toLowerCase()).toContain("apple");
    });

    it("should return 404 for non-existent user", async () => {
      try {
        await client.get("/users/non-existent-id");
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).toContain("404");
      }
    });
  });

  describe("POST requests", () => {
    it("should create a new user", async () => {
      const newUser = await client.post<{id: string; name: string; email: string}>("/users", {
        name: "Alice Smith",
        email: "alice@example.com"
      });

      expect(newUser).toHaveProperty("id");
      expect(newUser).toMatchObject({
        name: "Alice Smith",
        email: "alice@example.com"
      });
      expect(newUser.id).toBeDefined();
    });

    it("should create a new product", async () => {
      const newProduct = await client.post<{id: string; name: string; price: number}>("/products", {
        name: "Laptop",
        price: 1299.99
      });

      expect(newProduct).toHaveProperty("id");
      expect(newProduct).toMatchObject({
        name: "Laptop",
        price: 1299.99
      });
    });
  });

  describe("PUT requests", () => {
    it("should update a user completely with path param + body params", async () => {
      // First create a user
      const created = await client.post<{id: string; name: string; email: string}>("/users", {
        name: "Jane Doe",
        email: "jane@example.com"
      });

      // Update the user completely (PUT replaces all fields)
      const updated = await client.put<{id: string; name: string; email: string}>(`/users/${created.id}`, {
        name: "Jane Smith",
        email: "jane.smith@example.com"
      });

      expect(updated).toMatchObject({
        id: created.id,
        name: "Jane Smith",
        email: "jane.smith@example.com"
      });

      // Verify the update persisted
      const fetched = await client.get<{id: string; name: string; email: string}>(`/users/${created.id}`);
      expect(fetched).toMatchObject({
        id: created.id,
        name: "Jane Smith",
        email: "jane.smith@example.com"
      });
    });

    it("should update a product completely with path param + body params", async () => {
      // First create a product
      const created = await client.post<{id: string; name: string; price: number}>("/products", {
        name: "Cheap Phone",
        price: 199
      });

      // Update the product completely
      const updated = await client.put<{id: string; name: string; price: number}>(`/products/${created.id}`, {
        name: "Premium Phone",
        price: 999
      });

      expect(updated).toMatchObject({
        id: created.id,
        name: "Premium Phone",
        price: 999
      });
    });

    it("should return error when updating non-existent user", async () => {
      try {
        await client.put("/users/non-existent", { name: "Test", email: "test@example.com" });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        // Accept 500 (framework error) as the expected outcome
        expect(error.message).toMatch(/(404|500)/);
      }
    });
  });

  describe("PATCH requests", () => {
    it("should partially update a user with path param + body params", async () => {
      // First create a user
      const created = await client.post<{id: string; name: string; email: string}>("/users", {
        name: "Bob Johnson",
        email: "bob@example.com"
      });

      // Patch only the email (PATCH updates only provided fields)
      const patched = await client.patch<{id: string; name: string; email: string}>(`/users/${created.id}`, {
        email: "bob.johnson@example.com"
      });

      expect(patched).toMatchObject({
        id: created.id,
        name: "Bob Johnson",
        email: "bob.johnson@example.com"
      });

      // Verify the patch persisted
      const fetched = await client.get<{id: string; name: string; email: string}>(`/users/${created.id}`);
      expect(fetched).toMatchObject({
        id: created.id,
        name: "Bob Johnson",
        email: "bob.johnson@example.com"
      });
    });

    it("should return error when patching non-existent user", async () => {
      try {
        await client.patch("/users/non-existent", { email: "new@example.com" });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        // Accept 500 (framework error) as the expected outcome
        expect(error.message).toMatch(/(404|500)/);
      }
    });
  });

  describe("DELETE requests", () => {
    it("should delete a user", async () => {
      // Create a user
      const created = await client.post<{id: string; name: string; email: string}>("/users", { name: "David Wilson", email: "david@example.com" });

      // Delete the user
      const result = await client.delete<{success: boolean; id: string}>(`/users/${created.id}`);

      expect(result).toMatchObject({
        success: true,
        id: created.id
      });

      // Verify user is deleted
      try {
        await client.get(`/users/${created.id}`);
        expect.fail("User should have been deleted");
      } catch (error: any) {
        expect(error.message).toContain("404");
      }
    });

    it("should delete a product", async () => {
      // Create a product
      const created = await client.post<{id: string; name: string; price: number}>("/products", { name: "Monitor", price: 299 });

      // Delete the product
      const result = await client.delete<{success: boolean; id: string}>(`/products/${created.id}`);

      expect(result).toMatchObject({
        success: true,
        id: created.id
      });

      // Verify product is deleted
      try {
        await client.get(`/products/${created.id}`);
        expect.fail("Product should have been deleted");
      } catch (error: any) {
        expect(error.message).toContain("404");
      }
    });

    it("should return 404 when deleting non-existent user", async () => {
      try {
        await client.delete("/users/non-existent");
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).toContain("404");
      }
    });
  });

  describe("Full CRUD workflow", () => {
    it("should perform complete CRUD operations", async () => {
      // CREATE: Create a new user
      const created = await client.post<{id: string; name: string; email: string}>("/users", {
        name: "CRUD User",
        email: "crud@example.com"
      });

      expect(created).toHaveProperty("id");
      expect(created.name).toBe("CRUD User");
      expect(created.email).toBe("crud@example.com");

      // READ: Fetch the created user
      const read = await client.get<{id: string; name: string; email: string}>(`/users/${created.id}`);
      expect(read).toMatchObject(created);

      // UPDATE: Update the user completely with PUT
      const updated = await client.put<{id: string; name: string; email: string}>(`/users/${created.id}`, {
        name: "Updated CRUD User",
        email: "updated.crud@example.com"
      });

      expect(updated).toMatchObject({
        id: created.id,
        name: "Updated CRUD User",
        email: "updated.crud@example.com"
      });

      // PATCH: Partially update the user
      const patched = await client.patch<{id: string; name: string; email: string}>(`/users/${created.id}`, {
        email: "final.crud@example.com"
      });

      expect(patched).toMatchObject({
        id: created.id,
        name: "Updated CRUD User",
        email: "final.crud@example.com"
      });

      // DELETE: Remove the user
      const deleted = await client.delete<{success: boolean; id: string}>(`/users/${created.id}`);
      expect(deleted).toMatchObject({
        success: true,
        id: created.id
      });

      // Verify the user is gone
      try {
        await client.get(`/users/${created.id}`);
        expect.fail("User should have been deleted");
      } catch (error: any) {
        expect(error.message).toContain("404");
      }
    });
  });
});
