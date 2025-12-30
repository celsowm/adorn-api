import type { ScannedController, ScannedOperation, ScannedParameter } from "../analyze/scanControllers.js";
import type { ManifestV1, ControllerEntry, OperationEntry, ArgsSpec, HttpMethod } from "./format.js";
import { typeToJsonSchema } from "../schema/typeToJsonSchema.js";
import type { SchemaContext } from "../schema/typeToJsonSchema.js";
import ts from "typescript";

export function generateManifest(
  controllers: ScannedController[],
  checker: ts.TypeChecker,
  version: string
): ManifestV1 {
  const components = new Map<string, any>();
  const ctx: SchemaContext = { checker, components };

  const controllerEntries: ControllerEntry[] = controllers.map(ctrl => ({
    controllerId: ctrl.className,
    basePath: ctrl.basePath,
    operations: ctrl.operations.map(op => buildOperationEntry(op, ctx)),
  }));

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
    validation: {
      mode: "ajv-runtime",
      precompiledModule: null,
    },
    controllers: controllerEntries,
  };
}

function buildOperationEntry(op: ScannedOperation, ctx: SchemaContext): OperationEntry {
  const args: ArgsSpec = {
    body: null,
    path: [],
    query: [],
    headers: [],
  };

  const nonBodyParams = op.parameters.filter(p => !isBodyParam(p, op.httpMethod));
  buildPathArgs(nonBodyParams, op.pathParams, ctx, args);
  buildQueryArgs(nonBodyParams, op.queryParamName, ctx, args);
  buildHeaderArgs(nonBodyParams, op.headerParamName, ctx, args);

  if (["POST", "PUT", "PATCH"].includes(op.httpMethod)) {
    const bodyParam = op.parameters.find(p => isBodyParam(p, op.httpMethod));
    if (bodyParam) {
      const bodySchema = typeToJsonSchema(bodyParam.type, ctx);
      const schemaRef = bodySchema.$ref ?? "#/components/schemas/InlineBody";

      args.body = {
        index: bodyParam.index,
        required: !bodyParam.isOptional,
        contentType: "application/json",
        schemaRef,
      };
    }
  }

  const responseSchema = typeToJsonSchema(op.returnType, ctx);
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

function isBodyParam(param: ScannedParameter, httpMethod: string): boolean {
  if (["POST", "PUT", "PATCH"].includes(httpMethod)) {
    return param.index === 0;
  }
  return false;
}

function buildPathArgs(
  params: ScannedParameter[],
  pathParamNames: string[],
  ctx: SchemaContext,
  args: ArgsSpec
): void {
  for (const paramName of pathParamNames) {
    const param = params.find(p => p.name === paramName);
    if (param) {
      const paramSchema = typeToJsonSchema(param.type, ctx);
      const schemaRef = paramSchema.$ref ?? "#/components/schemas/InlinePathParam";

      args.path.push({
        name: paramName,
        index: param.index,
        required: !param.isOptional,
        schemaRef,
      });
    }
  }
}

function buildQueryArgs(
  params: ScannedParameter[],
  queryParamName: string | null,
  ctx: SchemaContext,
  args: ArgsSpec
): void {
  if (!queryParamName) return;

  const queryParam = params.find(p => p.name === queryParamName);
  if (!queryParam) return;

  const querySchema = typeToJsonSchema(queryParam.type, ctx);
  if (!querySchema.properties) return;

  const queryObjProps = querySchema.properties;
  for (const [propName, propSchema] of Object.entries(queryObjProps as Record<string, any>)) {
    const isRequired = querySchema.required?.includes(propName) ?? false;
    const propType = propSchema.type;
    let schemaRef = propSchema.$ref;
    if (!schemaRef && propType === "array" && propSchema.items?.$ref) {
      schemaRef = propSchema.items.$ref;
    } else if (!schemaRef) {
      schemaRef = "#/components/schemas/InlineQueryParam";
    }

    const paramIndex = params.findIndex(p => p.name === queryParamName);
    args.query.push({
      name: propName,
      index: paramIndex,
      required: !isRequired,
      schemaRef,
    });
  }
}

function buildHeaderArgs(
  params: ScannedParameter[],
  headerParamName: string | null,
  ctx: SchemaContext,
  args: ArgsSpec
): void {
  if (!headerParamName) return;

  const headerParam = params.find(p => p.name === headerParamName);
  if (!headerParam) return;

  const headerSchema = typeToJsonSchema(headerParam.type, ctx);
  if (!headerSchema.properties) return;

  const headerObjProps = headerSchema.properties;
  for (const [propName, propSchema] of Object.entries(headerObjProps as Record<string, any>)) {
    const isRequired = headerSchema.required?.includes(propName) ?? false;
    const propType = propSchema.type;
    let schemaRef = propSchema.$ref;
    if (!schemaRef && propType === "array" && propSchema.items?.$ref) {
      schemaRef = propSchema.items.$ref;
    } else if (!schemaRef) {
      schemaRef = "#/components/schemas/InlineHeaderParam";
    }

    const paramIndex = params.findIndex(p => p.name === headerParamName);
    args.headers.push({
      name: propName,
      index: paramIndex,
      required: !isRequired,
      schemaRef,
    });
  }
}
