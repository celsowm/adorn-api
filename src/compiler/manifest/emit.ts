import type { ScannedController, ScannedOperation } from "../analyze/scanControllers.js";
import type { ManifestV1, ControllerEntry, OperationEntry, ArgsSpec, HttpMethod } from "./format.js";
import { typeToJsonSchema } from "../schema/typeToJsonSchema.js";
import type { SchemaContext } from "../schema/typeToJsonSchema.js";
import { extractQueryStyleOptions } from "../analyze/extractQueryStyle.js";
import ts from "typescript";

type ValidationMode = "none" | "ajv-runtime" | "precompiled";

export function generateManifest(
  controllers: ScannedController[],
  checker: ts.TypeChecker,
  version: string,
  validationMode: ValidationMode = "ajv-runtime"
): ManifestV1 {
  const components = new Map<string, any>();
  const ctx: SchemaContext = {
    checker,
    components,
    typeStack: new Set(),
    typeNameStack: [],
  };

  const controllerEntries: ControllerEntry[] = controllers.map(ctrl => ({
    controllerId: ctrl.className,
    basePath: ctrl.basePath,
    operations: ctrl.operations.map(op => buildOperationEntry(op, ctx)),
  }));

  const validationConfig: { mode: "none" | "ajv-runtime" | "precompiled"; precompiledModule: string | null } = 
    validationMode === "precompiled"
    ? { mode: "precompiled", precompiledModule: null }
    : validationMode === "none"
      ? { mode: "none", precompiledModule: null }
      : { mode: "ajv-runtime", precompiledModule: null };

  return {
    manifestVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: {
      name: "adorn-api",
      version,
      typescript: ts.version,
    },
    schemas: {
      kind: "openapi-3.1",
      file: "./openapi.json",
      componentsSchemasPointer: "/components/schemas",
    },
    validation: validationConfig,
    controllers: controllerEntries,
  };
}

function buildOperationEntry(op: ScannedOperation, ctx: SchemaContext): OperationEntry {
  const args: ArgsSpec = {
    body: null,
    path: [],
    query: [],
    headers: [],
    cookies: [],
  };

  buildPathArgs(op, ctx, args);
  buildQueryArgs(op, ctx, args);
  buildHeaderArgs(op, ctx, args);
  buildCookieArgs(op, ctx, args);

  if (op.bodyParamIndex !== null) {
    const bodyParam = op.parameters[op.bodyParamIndex];
    if (bodyParam) {
      const bodySchema = typeToJsonSchema(bodyParam.type, ctx);
      const schemaRef = bodySchema.$ref ?? "#/components/schemas/InlineBody";

      args.body = {
        index: bodyParam.index,
        required: !bodyParam.isOptional,
        contentType: op.bodyContentType ?? "application/json",
        schemaRef,
      };
    }
  }

  const responseSchema = typeToJsonSchema(op.returnType, ctx, op.returnTypeNode);
  const status = op.httpMethod === "POST" ? 201 : 200;

  let schemaRef = responseSchema.$ref;
  let isArray = false;

  if (!schemaRef && responseSchema.type === "array" && responseSchema.items?.$ref) {
    schemaRef = responseSchema.items.$ref;
    isArray = true;
  } else if (!schemaRef) {
    schemaRef = "#/components/schemas/InlineResponse";
  }

  return {
    operationId: op.operationId,
    http: {
      method: op.httpMethod as HttpMethod,
      path: op.path,
    },
    handler: {
      methodName: op.methodName,
    },
    args,
    responses: [
      {
        status,
        contentType: "application/json",
        schemaRef,
        isArray,
      },
    ],
  };
}

function buildPathArgs(op: ScannedOperation, ctx: SchemaContext, args: ArgsSpec): void {
  for (const paramIndex of op.pathParamIndices) {
    const param = op.parameters[paramIndex];
    if (param) {
      const paramSchema = typeToJsonSchema(param.type, ctx);

      args.path.push({
        name: param.name,
        index: param.index,
        required: !param.isOptional,
        schemaRef: paramSchema.$ref ?? "#/components/schemas/InlinePathParam",
        schemaType: paramSchema.type,
      });
    }
  }
}

function buildQueryArgs(op: ScannedOperation, ctx: SchemaContext, args: ArgsSpec): void {
  if (op.queryObjectParamIndex !== null) {
    const queryParam = op.parameters[op.queryObjectParamIndex];
    if (queryParam) {
      const queryStyle = extractQueryStyleOptions(ctx.checker, op.methodDeclaration);
      const querySchema = typeToJsonSchema(queryParam.type, ctx);
      if (queryStyle?.style === "deepObject") {
        const schemaRef = querySchema.$ref ?? "#/components/schemas/InlineQueryParam";
        args.query.push({
          name: queryParam.name,
          index: queryParam.index,
          required: !queryParam.isOptional,
          schemaRef,
          schemaType: querySchema.type,
          serialization: {
            style: "deepObject",
            explode: queryStyle.explode ?? true,
            allowReserved: queryStyle.allowReserved,
          },
        });
      } else {
        if (!querySchema.properties) return;

        for (const [propName, propSchema] of Object.entries(querySchema.properties as Record<string, any>)) {
          const isRequired = querySchema.required?.includes(propName) ?? false;
          let schemaRef = propSchema.$ref;
          if (!schemaRef) {
            schemaRef = "#/components/schemas/InlineQueryParam";
          }

          args.query.push({
            name: propName,
            index: queryParam.index,
            required: !isRequired,
            schemaRef,
            schemaType: propSchema.type,
          });
        }
      }
    }
  }

  for (const paramIndex of op.queryParamIndices) {
    const param = op.parameters[paramIndex];
    if (param) {
      const paramSchema = typeToJsonSchema(param.type, ctx);
      const schemaRef = paramSchema.$ref ?? "#/components/schemas/InlineQueryParam";

      args.query.push({
        name: param.name,
        index: param.index,
        required: !param.isOptional,
        schemaRef,
        schemaType: paramSchema.type,
      });
    }
  }
}

function buildHeaderArgs(op: ScannedOperation, ctx: SchemaContext, args: ArgsSpec): void {
  if (op.headerObjectParamIndex === null) return;

  const headerParam = op.parameters[op.headerObjectParamIndex];
  if (!headerParam) return;

  const headerSchema = typeToJsonSchema(headerParam.type, ctx);
  if (!headerSchema.properties) return;

  for (const [propName, propSchema] of Object.entries(headerSchema.properties as Record<string, any>)) {
    const isRequired = headerSchema.required?.includes(propName) ?? false;
    let schemaRef = propSchema.$ref;
    if (!schemaRef) {
      schemaRef = "#/components/schemas/InlineHeaderParam";
    }

    args.headers.push({
      name: propName,
      index: headerParam.index,
      required: !isRequired,
      schemaRef,
      schemaType: propSchema.type,
    });
  }
}

function buildCookieArgs(op: ScannedOperation, ctx: SchemaContext, args: ArgsSpec): void {
  if (op.cookieObjectParamIndex === null) return;

  const cookieParam = op.parameters[op.cookieObjectParamIndex];
  if (!cookieParam) return;

  const cookieSchema = typeToJsonSchema(cookieParam.type, ctx);
  if (!cookieSchema.properties) return;

  for (const [propName, propSchema] of Object.entries(cookieSchema.properties as Record<string, any>)) {
    const isRequired = cookieSchema.required?.includes(propName) ?? false;
    let schemaRef = propSchema.$ref;
    if (!schemaRef) {
      schemaRef = "#/components/schemas/InlineCookieParam";
    }

    args.cookies.push({
      name: propName,
      index: cookieParam.index,
      required: !isRequired,
      schemaRef,
      schemaType: propSchema.type,
      serialization: { style: "form", explode: true },
    });
  }
}
