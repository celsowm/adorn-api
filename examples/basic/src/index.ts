import express from "express";
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  ExpressAdapter,
  OpenApiGenerator,
  List,
  Create,
  Update,
} from "adorn-api";

@Controller("/users")
class UserController {
  private users: any[] = [
    { id: "1", name: "John Doe", email: "john@example.com", role: "admin" },
    { id: "2", name: "Jane Smith", email: "jane@example.com", role: "user" },
  ];

  @List()
  async getAll(): Promise<any[]> {
    return this.users;
  }

  @Get("/:id")
  async getById(params: { id: string }): Promise<any> {
    const user = this.users.find((u) => u.id === params.id);
    return user || { error: "User not found" };
  }

  @Create()
  async create(body: {
    name: string;
    email: string;
    role: string;
  }): Promise<any> {
    const newUser = {
      id: String(this.users.length + 1),
      ...body,
    };
    this.users.push(newUser);
    return newUser;
  }

  @Put("/:id")
  async update(
    params: { id: string },
    body: Partial<{ name: string; email: string; role: string }>,
  ): Promise<any> {
    const index = this.users.findIndex((u) => u.id === params.id);
    if (index === -1) {
      return { error: "User not found" };
    }
    this.users[index] = { ...this.users[index], ...body };
    return this.users[index];
  }

  @Delete("/:id")
  async delete(params: { id: string }): Promise<{ success: boolean }> {
    const index = this.users.findIndex((u) => u.id === params.id);
    if (index !== -1) {
      this.users.splice(index, 1);
    }
    return { success: true };
  }
}

@Controller("/products")
class ProductController {
  private products: any[] = [
    { id: "1", name: "Laptop", price: 999.99 },
    { id: "2", name: "Phone", price: 599.99 },
  ];

  @List()
  async getAll(): Promise<any[]> {
    return this.products;
  }

  @Create()
  async create(body: { name: string; price: number }): Promise<any> {
    const newProduct = {
      id: String(Date.now()),
      ...body,
    };
    this.products.push(newProduct);
    return newProduct;
  }
}

async function main() {
  const app = express();
  app.use(express.json());

  const adapter = new ExpressAdapter(app);
  adapter.registerController(UserController);
  adapter.registerController(ProductController);

  const generator = new OpenApiGenerator();
  const openapi = generator.generateDocument({
    info: {
      title: "Adorn-API Example",
      version: "1.0.0",
      description: "Demonstrating smart decorators with Metal-ORM integration",
    },
    servers: [{ url: "http://localhost:3000", description: "Local server" }],
  });

  app.get("/api-docs", (_req, res) => {
    res.json(openapi);
  });

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 OpenAPI docs: http://localhost:${PORT}/api-docs`);
    console.log(``);
    console.log(`Endpoints:`);
    console.log(`  GET    /users           - List all users`);
    console.log(`  GET    /users/:id       - Get user by ID`);
    console.log(`  POST   /users           - Create user`);
    console.log(`  PUT    /users/:id       - Update user`);
    console.log(`  DELETE /users/:id       - Delete user`);
    console.log(`  GET    /products        - List products`);
    console.log(`  POST   /products        - Create product`);
  });
}

main().catch(console.error);
