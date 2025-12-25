import type { z } from "zod";
import type { SchemaRef } from "../core/schema.js";
import type { RequestContext } from "../core/express.js";
import type { RouteOptions } from "../core/decorators.js";

export type BuiltRoute<
  TParams extends SchemaRef | undefined,
  TQuery extends SchemaRef,
  TBody extends SchemaRef | undefined,
  TResponse extends SchemaRef,
> = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  opts: RouteOptions & {
    params?: TParams;
    query: TQuery;
    body?: TBody;
    response: TResponse;
  };
};

type InferRef<T extends SchemaRef | undefined> = T extends SchemaRef
  ? z.infer<T["schema"] & z.ZodTypeAny>
  : {};

type InferBody<T extends SchemaRef | undefined> = T extends SchemaRef
  ? z.infer<T["schema"] & z.ZodTypeAny>
  : undefined;

export type RouteCtx<TRoute extends BuiltRoute<any, any, any, any>> = Omit<
  RequestContext,
  "input"
> & {
  input: {
    params: InferRef<TRoute["opts"]["params"]>;
    query: InferRef<TRoute["opts"]["query"]>;
    body: InferBody<TRoute["opts"]["body"]>;
    include: RequestContext["input"]["include"];
  };
};
