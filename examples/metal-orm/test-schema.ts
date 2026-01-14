import "reflect-metadata";
import { EntitySchemaBuilder } from "../../dist/metal-orm-integration/entity-schema-builder.js";
import { bootstrapEntities, getTableDefFromEntity } from "metal-orm";
import { User } from "./src/entities.ts";
import { Post as PostModel } from "./src/entities.ts";

console.log("[TEST] Starting test...");

bootstrapEntities();

console.log("[TEST] Calling EntitySchemaBuilder.create(User)...");
import fs from "fs";

bootstrapEntities();

// Check what getTableDefFromEntity returns
const tableDef = getTableDefFromEntity(User);
console.log("=== Table Def from getTableDefFromEntity ===");
console.log(JSON.stringify(tableDef, null, 2));

// Check metadata
const symbols = Object.getOwnPropertySymbols(User);
for (const sym of symbols) {
  if (sym.description === "Symbol.metadata") {
    const metadata = User[sym];
    const decorators = metadata?.["metal-orm:decorators"];
    console.log("\n=== Decorators Metadata ===");
    console.log(JSON.stringify(decorators, null, 2));
  }
}

const createUserSchema = EntitySchemaBuilder.create(User);
const updateUserSchema = EntitySchemaBuilder.update(User);
const idParamsSchema = EntitySchemaBuilder.idParams(User);
const createPostSchema = EntitySchemaBuilder.create(PostModel);
const userResponseSchema = EntitySchemaBuilder.response(User);

console.log("\n=== Create User Schema Shape ===");
console.log("Fields:", Object.keys(createUserSchema.shape).join(", "));

console.log("\n=== Update User Schema Shape ===");
console.log("Fields:", Object.keys(updateUserSchema.shape).join(", "));
