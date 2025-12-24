import { z } from "zod";
import { Controller, Get, Post, named, p, q, EmptyQuery } from "../../../src/index.js";

const UserParams = named("UserParams", z.object({ id: p.int() }));
const CreateUserBody = named("CreateUserBody", z.object({ name: z.string().min(1) }));
const UserResponse = named("UserResponse", z.object({ id: z.number().int(), name: z.string() }));

@Controller("/users", { tags: ["Users"] })
export class UsersController {
  @Get("/{id}", {
    params: UserParams,
    query: EmptyQuery,
    response: UserResponse,
    includePolicy: { allowed: ["posts"], maxDepth: 2 }
  })
  async getUser(ctx: any) {
    const { id } = ctx.input.params as { id: number };
    return { id, name: "alice" };
  }

  @Post("/", {
    query: EmptyQuery,
    body: CreateUserBody,
    response: UserResponse
  })
  async createUser(ctx: any) {
    const body = ctx.input.body as { name: string };
    return { id: 1, name: body.name };
  }
}