import type { ScannedController } from "../analyze/scanControllers.js";
import type { ManifestV1, ControllerEntry, OperationEntry, ArgsSpec } from "./format.js";
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

function buildOperationEntry(op: any, ctx: SchemaContext): OperationEntry {
  const args: ArgsSpec = {
    body: null,
    path: [],
    query: [],
    headers: [],
  };

  if (["POST", "PUT", "PATCH"].includes(op.httpMethod)) {
    const bodyParam = op.parameters[0];
    if (bodyParam) {
      const bodySchema = typeToJsonSchema(bodyParam.type, ctx);
      const schemaRef = bodySchema.$ref ?? "#/components/schemas/InlineBody";

      args.body = {
        index: 0,
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
      method: op.httpMethod,
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
