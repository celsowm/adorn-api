import { Controller, Get, Post } from "adorn-api";
import { Auth } from "adorn-api/decorators";
import { Public } from "adorn-api/decorators";

interface User {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin";
  scopes: string[];
}

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: Omit<User, "scopes">;
}

const users: User[] = [
  { id: 1, username: "alice", email: "alice@example.com", role: "admin", scopes: ["read", "write", "admin"] },
  { id: 2, username: "bob", email: "bob@example.com", role: "user", scopes: ["read"] },
];

const tokens: Map<string, User> = new Map();

@Controller("/auth")
export class AuthController {
  @Post("/login")
  async login(body: LoginRequest): Promise<LoginResponse | { error: string }> {
    const user = users.find((u) => u.username === body.username);
    if (!user) {
      return { error: "Invalid username or password" };
    }
    if (body.password !== "password123") {
      return { error: "Invalid username or password" };
    }
    const token = `token-${Date.now()}-${user.id}`;
    tokens.set(token, user);
    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    };
  }

  @Post("/logout")
  @Auth("BearerAuth")
  async logout(req: any): Promise<{ message: string }> {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      tokens.delete(token);
    }
    return { message: "Logged out successfully" };
  }
}

@Controller("/api")
export class ApiController {
  @Get("/public")
  @Public()
  async publicEndpoint(): Promise<{ message: string; timestamp: string }> {
    return {
      message: "This is a public endpoint - no authentication required",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/profile")
  @Auth("BearerAuth")
  async getProfile(req: any): Promise<{ user: Omit<User, "scopes">; message: string }> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");
    const user = tokens.get(token);
    return {
      user: { id: user!.id, username: user!.username, email: user!.email, role: user!.role },
      message: "This is a protected endpoint - you are authenticated!",
    };
  }

  @Get("/data")
  @Auth("BearerAuth", { scopes: ["read"] })
  async getData(): Promise<{ data: string[]; message: string }> {
    return {
      data: ["item1", "item2", "item3"],
      message: "This endpoint requires 'read' scope",
    };
  }

  @Post("/items")
  @Auth("BearerAuth", { scopes: ["write"] })
  async createItem(req: any): Promise<{ id: number; name: string; createdBy: string; message: string }> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");
    const user = tokens.get(token!);
    return {
      id: Math.floor(Math.random() * 1000),
      name: req.body.name,
      createdBy: user!.username,
      message: "This endpoint requires 'write' scope",
    };
  }

  @Get("/admin")
  @Auth("BearerAuth", { scopes: ["admin"] })
  async adminOnly(): Promise<{ message: string; secret: string }> {
    return {
      message: "This is an admin-only endpoint",
      secret: "Admin secret: The quick brown fox jumps over the lazy dog",
    };
  }

  @Get("/all-users")
  @Auth("BearerAuth")
  async getAllUsers(req: any): Promise<{ users: Omit<User, "scopes">[]; requester: string }> {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");
    const requester = tokens.get(token!);
    return {
      users: users.map((u) => ({ id: u.id, username: u.username, email: u.email, role: u.role })),
      requester: requester!.username,
    };
  }
}
