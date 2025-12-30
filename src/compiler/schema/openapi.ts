import ts from "typescript";
import type { ScannedController, ScannedOperation } from "../analyze/scanControllers.js";
import { typeToJsonSchema } from "./typeToJsonSchema.js";
import type { SchemaContext, JsonSchema } from "./typeToJsonSchema.js";

export interface OpenAPI31 {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
  };
  components: {
    schemas: Record<string, JsonSchema>;
  };
  paths: Record<string, Record<string, any>>;
}

export function generateOpenAPI(
  controllers: ScannedController[],
  checker: ts.TypeChecker,
  options: { title?: string; version?: string } = {}
): OpenAPI31 {
  const components = new Map<string, JsonSchema>();
  const ctx: SchemaContext = { checker, components };

  const paths: Record<string, Record<string, any>> = {};

  for (const controller of controllers) {
    for (const operation of controller.operations) {
      const fullPath = joinPaths(controller.basePath, operation.path);

      if (!paths[fullPath]) {
        paths[fullPath] = {};
      }

      const method = operation.httpMethod.toLowerCase();
      paths[fullPath][method] = buildOperation(operation, ctx);
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: options.title ?? "API",
      version: options.version ?? "1.0.0",
    },
    components: {
      schemas: Object.fromEntries(components),
    },
    paths,
  };
}

function buildOperation(operation: ScannedOperation, ctx: SchemaContext): any {
  const op: any = {
    operationId: operation.operationId,
    responses: {},
  };

  const responseSchema = typeToJsonSchema(operation.returnType, ctx);

  const status = operation.httpMethod === "POST" ? 201 : 200;
  op.responses[status] = {
    description: status === 201 ? "Created" : "OK",
    content: {
      "application/json": {
        schema: responseSchema,
      },
    },
  };

  if (["POST", "PUT", "PATCH"].includes(operation.httpMethod)) {
    const bodyParam = operation.parameters[0];
    if (bodyParam) {
      const bodySchema = typeToJsonSchema(bodyParam.type, ctx);
      op.requestBody = {
        required: !bodyParam.isOptional,
        content: {
          "application/json": {
            schema: bodySchema,
          },
        },
      };
    }
  }

  return op;
}

function joinPaths(base: string, sub: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const s = sub.startsWith("/") ? sub : `/${sub}`;
  return b + s || "/";
}
