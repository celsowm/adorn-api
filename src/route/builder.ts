import { z } from "zod";
import { named, EmptyQuery } from "../core/schema.js";
import type { SchemaRef } from "../core/schema.js";
import type { RouteOptions } from "../core/decorators.js";
import type { IncludePolicy } from "../core/metadata.js";
import type { BuiltRoute } from "./types.js";

export type SchemaInput =
  | SchemaRef
  | z.ZodTypeAny
  | {
      toSchemaRef: (id: string) => SchemaRef;
      getIncludeKeys?: () => string[];
    };

function sanitizeIdPart(x: string): string {
  return x
    .replace(/\{([^}]+)\}/g, "$1")
    .replace(/[^a-zA-Z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function autoSchemaId(
  method: string,
  path: string,
  slot: "params" | "query" | "body" | "response",
): string {
  const m = sanitizeIdPart(method.toUpperCase());
  const p = sanitizeIdPart(path.replace(/^\//, "").replace(/\//g, "."));
  return `adorn.${m}.${p}.${slot}`;
}

function asSchemaRef(input: SchemaInput, id: string): SchemaRef {
  if ((input as any)?.provider === "zod" && typeof (input as any)?.id === "string") {
    return input as SchemaRef;
  }
  if ((input as any)?.toSchemaRef) {
    return (input as any).toSchemaRef(id);
  }
  return named(id, input as z.ZodTypeAny);
}

export class RouteBuilder<
  TMethod extends BuiltRoute<any, any, any, any>["method"],
  TParams extends SchemaRef | undefined = undefined,
  TQuery extends SchemaRef = typeof EmptyQuery,
  TBody extends SchemaRef | undefined = undefined,
  TResponse extends SchemaRef | undefined = undefined,
> {
  private paramsRef?: SchemaRef;
  private queryRef: SchemaRef = EmptyQuery;
  private bodyRef?: SchemaRef;
  private responseRef?: SchemaRef;

  private includePolicy?: IncludePolicy;

  constructor(private method: TMethod, private path: string) {}

  /** Route-level include policy. If omitted and response builder exposes includes, adorn derives allowed includes automatically. */
  include(allowed: string[] | { allowed: string[]; maxDepth?: number }) {
    const policy: IncludePolicy = Array.isArray(allowed)
      ? { allowed }
      : { allowed: allowed.allowed, maxDepth: allowed.maxDepth };
    this.includePolicy = policy;
    return this;
  }

  /** Manual params as fields (no z.object in app code). */
  paramsFields<T extends Record<string, z.ZodTypeAny | SchemaRef>>(shape: T) {
    const zshape: Record<string, z.ZodTypeAny> = {};
    for (const [k, v] of Object.entries(shape)) {
      zshape[k] = (v as any)?.schema ? (v as SchemaRef).schema : (v as z.ZodTypeAny);
    }
    const id = autoSchemaId(this.method, this.path, "params");
    this.paramsRef = named(id, z.object(zshape).strict());
    return this as any as RouteBuilder<TMethod, SchemaRef, TQuery, TBody, TResponse>;
  }

  /** Params from SchemaRef / Zod schema / provider builder. */
  params(schema: SchemaInput) {
    const id = autoSchemaId(this.method, this.path, "params");
    this.paramsRef = asSchemaRef(schema, id);
    return this as any as RouteBuilder<TMethod, SchemaRef, TQuery, TBody, TResponse>;
  }

  /** Query fields helper. */
  queryFields<T extends Record<string, z.ZodTypeAny | SchemaRef>>(shape: T, passthrough = true) {
    const zshape: Record<string, z.ZodTypeAny> = {};
    for (const [k, v] of Object.entries(shape)) {
      zshape[k] = (v as any)?.schema ? (v as SchemaRef).schema : (v as z.ZodTypeAny);
    }
    const id = autoSchemaId(this.method, this.path, "query");
    const obj = z.object(zshape);
    this.queryRef = named(id, passthrough ? obj.passthrough() : obj.strict());
    return this as any as RouteBuilder<TMethod, TParams, SchemaRef, TBody, TResponse>;
  }

  query(schema: SchemaInput) {
    const id = autoSchemaId(this.method, this.path, "query");
    this.queryRef = asSchemaRef(schema, id);
    return this as any as RouteBuilder<TMethod, TParams, SchemaRef, TBody, TResponse>;
  }

  body(schema: SchemaInput) {
    const id = autoSchemaId(this.method, this.path, "body");
    this.bodyRef = asSchemaRef(schema, id);
    return this as any as RouteBuilder<TMethod, TParams, TQuery, SchemaRef, TResponse>;
  }

  response(schema: SchemaInput) {
    const id = autoSchemaId(this.method, this.path, "response");
    this.responseRef = asSchemaRef(schema, id);

    // Auto-derive includePolicy if supported and not explicitly set.
    if (!this.includePolicy && (schema as any)?.getIncludeKeys) {
      const allowed = (schema as any).getIncludeKeys();
      if (Array.isArray(allowed) && allowed.length) this.includePolicy = { allowed };
    }

    return this as any as RouteBuilder<TMethod, TParams, TQuery, TBody, SchemaRef>;
  }

  build(): BuiltRoute<TParams, TQuery, TBody, NonNullable<TResponse>> {
    if (!this.responseRef) {
      throw new Error(`Route ${this.method} ${this.path}: response schema is required`);
    }
    const needsBody = this.method === "POST" || this.method === "PUT" || this.method === "PATCH";
    if (needsBody && !this.bodyRef) {
      throw new Error(`Route ${this.method} ${this.path}: body schema is required for ${this.method}`);
    }

    const opts: RouteOptions = {
      params: this.paramsRef,
      query: this.queryRef,
      body: this.bodyRef,
      response: this.responseRef,
      includePolicy: this.includePolicy,
    };

    return { method: this.method, path: this.path, opts } as any;
  }
}

export const route = {
  get: (path: string) => new RouteBuilder("GET", path),
  post: (path: string) => new RouteBuilder("POST", path),
  put: (path: string) => new RouteBuilder("PUT", path),
  patch: (path: string) => new RouteBuilder("PATCH", path),
  delete: (path: string) => new RouteBuilder("DELETE", path),
};
