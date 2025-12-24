import { z } from "zod";
import { ValidationError } from "./errors.js";

export type SchemaRef =
  | { provider: "zod"; id: string; schema: z.ZodTypeAny };

export function named(id: string, schema: z.ZodTypeAny): SchemaRef {
  return { provider: "zod", id, schema };
}

export const EmptyQuery = named("EmptyQuery", z.object({}).passthrough());
export const EmptyParams = named("EmptyParams", z.object({}).passthrough());
export const EmptyBody = named("EmptyBody", z.any());
export const EmptyResponse = named("EmptyResponse", z.any());

export const p = {
  int: () => z.coerce.number().int(),
  uuid: () => z.string().uuid(),
  boolean: () =>
    z.preprocess((v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      if (typeof v !== "string") return v;
      const s = v.trim().toLowerCase();
      if (["true", "1", "on", "yes"].includes(s)) return true;
      if (["false", "0", "off", "no"].includes(s)) return false;
      return v;
    }, z.boolean())
};

export const q = {
  int: () => z.coerce.number().int(),
  boolean: () =>
    z.preprocess((v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      if (typeof v !== "string") return v;
      const s = v.trim().toLowerCase();
      if (["true", "1", "on", "yes"].includes(s)) return true;
      if (["false", "0", "off", "no"].includes(s)) return false;
      return v;
    }, z.boolean()),
  array: <T extends z.ZodTypeAny>(inner: T) =>
    z.preprocess((v) => {
      if (v == null) return [];
      if (Array.isArray(v)) return v.flatMap(x => (typeof x === "string" ? x.split(",") : [x])).map(x => (typeof x === "string" ? x.trim() : x));
      if (typeof v === "string") return v.split(",").map(s => s.trim()).filter(Boolean);
      return v;
    }, z.array(inner))
};

export function validateOrThrow(ref: SchemaRef, value: unknown, source: "params" | "query" | "body" | "response") {
  const parsed = ref.schema.safeParse(value);
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues.map((i) => ({
    source,
    path: i.path as Array<string | number>,
    message: i.message,
    code: i.code
  }));

  throw new ValidationError("validation failed", issues);
}