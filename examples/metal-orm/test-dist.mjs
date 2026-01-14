import "reflect-metadata";
import { EntitySchemaBuilder } from "../../dist/metal-orm-integration/entity-schema-builder.js";
import { bootstrapEntities } from "metal-orm";
import { User } from "./entities.js";

console.log("[TEST] Starting test...");
bootstrapEntities();
console.log("[TEST] Calling EntitySchemaBuilder.create(User)...");
const schema = EntitySchemaBuilder.create(User);
console.log("[TEST] Done. Fields:", Object.keys(schema.shape).join(", "));
