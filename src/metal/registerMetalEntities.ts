/**
 * Utilities for registering Metal ORM entities as OpenAPI components.
 */
import { schemaFromEntity, type SchemaFromEntityOptions } from "./schemaFromEntity.js";

function deepMerge(a: any, b: any): any {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if (a && typeof a === "object" && b && typeof b === "object") {
    const out: any = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = deepMerge(out[k], v);
    return out;
  }
  return b ?? a;
}

/**
 * Options for registering Metal ORM entities.
 */
export interface RegisterMetalEntitiesOptions extends SchemaFromEntityOptions {
  /** How to handle existing schemas with the same name: "override" or "merge" (default: "merge") */
  merge?: "override" | "merge";
}

/**
 * Registers Metal ORM entity schemas in an OpenAPI document.
 * 
 * @param openapi - The OpenAPI document to modify (will be mutated)
 * @param entities - Array of entity class constructors to register
 * @param opts - Optional configuration for schema generation and merging
 * 
 * @example
 * ```ts
 * const openapi = { components: { schemas: {} } };
 * registerMetalEntities(openapi, [User, Post, Comment]);
 * ```
 */
export function registerMetalEntities(
  openapi: any,
  entities: Function[],
  opts: RegisterMetalEntitiesOptions = {}
) {
  openapi.components ??= {};
  openapi.components.schemas ??= {};

  const mergeMode = opts.merge ?? "merge";

  for (const ctor of entities) {
    const s = schemaFromEntity(ctor, opts);
    if (!s) continue;

    const name = s.title || ctor.name;
    const existing = openapi.components.schemas[name];

    if (!existing || mergeMode === "override") {
      openapi.components.schemas[name] = s;
    } else {
      openapi.components.schemas[name] = deepMerge(existing, s);
    }
  }
}
