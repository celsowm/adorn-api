import { schemaFromEntity, type SchemaFromEntityOptions, type JsonSchema } from "./schemaFromEntity.js";

function deepMerge(a: any, b: any): any {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if (a && typeof a === "object" && b && typeof b === "object") {
    const out: any = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = deepMerge(out[k], v);
    return out;
  }
  return b ?? a;
}

export interface RegisterMetalEntitiesOptions extends SchemaFromEntityOptions {
  merge?: "override" | "merge";
}

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
