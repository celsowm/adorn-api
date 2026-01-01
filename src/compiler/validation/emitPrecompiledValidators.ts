import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { AnySchema } from "ajv";

interface OpenApi {
  openapi: string;
  components?: {
    schemas?: Record<string, unknown>;
  };
}

interface Manifest {
  manifestVersion: number;
  controllers: Array<{
    controllerId: string;
    basePath: string;
    operations: Array<{
      operationId: string;
      args: {
        body?: {
          schemaRef: string;
          contentType: string;
        } | null;
        response?: Array<{
          status: number;
          contentType: string;
          schemaRef?: string;
        }>;
      };
      responses: Array<{
        status: number;
        contentType: string;
        schemaRef: string;
      }>;
    }>;
  }>;
}

const OAS_SCHEMA_ONLY = new Set(["discriminator", "xml", "externalDocs", "example"]);

function sanitizeSchemaForAjv(schema: unknown): unknown {
  if (schema == null || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForAjv);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (OAS_SCHEMA_ONLY.has(k)) continue;
    if (k.startsWith("x-")) continue;
    out[k] = sanitizeSchemaForAjv(v);
  }
  return out;
}

function rewriteComponentRefs(schema: unknown): unknown {
  if (schema == null || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(rewriteComponentRefs);

  if (typeof (schema as Record<string, unknown>).$ref === "string") {
    const ref = (schema as Record<string, unknown>).$ref as string;
    const m = ref.match(/^#\/components\/schemas\/(.+)$/);
    if (m) {
      return { ...schema, $ref: m[1] };
    }
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    out[k] = rewriteComponentRefs(v);
  }
  return out;
}

function safeId(s: string): string {
  return s.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z_]/, "_$&");
}

function schemaNameFromRef(schemaRef: string): string {
  return schemaRef.replace(/^#\/components\/schemas\//, "");
}

export interface EmitPrecompiledValidatorsOptions {
  outDir: string;
  openapi: OpenApi;
  manifest: Manifest;
  strict?: "off" | "log" | "error";
  formatsMode?: "fast" | "full";
}

export async function emitPrecompiledValidators(opts: EmitPrecompiledValidatorsOptions): Promise<{
  validatorsCjsPath: string;
  validatorsEsmPath: string;
  hash: string;
}> {
  const outDir = opts.outDir;
  const cjsPath = path.join(outDir, "validators.cjs");
  const esmPath = path.join(outDir, "validators.mjs");
  const metaPath = path.join(outDir, "validators.meta.json");

  fs.mkdirSync(outDir, { recursive: true });

  const schemas: AnySchema[] = [];

  for (const [name, sch] of Object.entries(opts.openapi.components?.schemas ?? {})) {
    const clean = rewriteComponentRefs(sanitizeSchemaForAjv(sch));
    schemas.push({ ...(clean as object), $id: name } as AnySchema);
  }

  const opIndex: Record<string, { body?: string; response: Record<string, string> }> = {};

  for (const ctrl of opts.manifest.controllers ?? []) {
    for (const op of ctrl.operations ?? []) {
      const entry: { body?: string; response: Record<string, string> } = { response: {} };
      opIndex[op.operationId] = entry;

      if (op.args.body?.schemaRef) {
        const typeName = schemaNameFromRef(op.args.body.schemaRef);
        const id = safeId(`op_${op.operationId}_body`);
        schemas.push({ $id: id, $ref: typeName } as AnySchema);
        entry.body = id;
      }

      for (const r of op.responses ?? []) {
        if (!r.schemaRef) continue;
        const typeName = schemaNameFromRef(r.schemaRef);
        const key = `${r.status}|${r.contentType}`;
        const id = safeId(`op_${op.operationId}_res_${r.status}_${r.contentType}`);
        schemas.push({ $id: id, $ref: typeName } as AnySchema);
        entry.response[key] = id;
      }
    }
  }

  const strictOpt = opts.strict === "off" ? false : opts.strict === "log" ? "log" : true;

  const ajv = new Ajv.default({
    schemas,
    allErrors: true,
    strict: strictOpt,
    code: { source: true },
  });

  addFormats.default(ajv, { mode: opts.formatsMode ?? "full" });

  let cjs: string;
  const standaloneModule = require("ajv/dist/standalone");
  if (typeof standaloneModule === "function") {
    cjs = standaloneModule(ajv);
  } else if (standaloneModule && typeof standaloneModule.default === "function") {
    cjs = standaloneModule.default(ajv);
  } else {
    throw new Error("Unable to find standalone code generator in ajv/dist/standalone");
  }

  cjs += "\n\n// --- adorn-api operation lookup (generated) ---\n";
  cjs += "exports.validators = {\n";
  for (const [operationId, v] of Object.entries(opIndex)) {
    cjs += `  ${JSON.stringify(operationId)}: {\n`;
    cjs += `    body: ${v.body ? `exports[${JSON.stringify(v.body)}]` : "undefined"},\n`;
    cjs += `    response: {\n`;
    for (const [key, id] of Object.entries(v.response)) {
      cjs += `      ${JSON.stringify(key)}: exports[${JSON.stringify(id)}],\n`;
    }
    cjs += `    }\n`;
    cjs += `  },\n`;
  }
  cjs += "};\n";

  fs.writeFileSync(cjsPath, cjs, "utf8");

  const esm = `// .adorn/validators.mjs (generated)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cjs = require("./validators.cjs");

export const validators = cjs.validators;

export function validateBody(operationId, data) {
  const v = validators?.[operationId]?.body;
  if (!v) return { ok: true, errors: null };
  const ok = v(data);
  return { ok, errors: ok ? null : v.errors };
}

export function validateResponse(operationId, status, contentType, data) {
  const key = String(status) + "|" + String(contentType);
  const v = validators?.[operationId]?.response?.[key];
  if (!v) return { ok: true, errors: null };
  const ok = v(data);
  return { ok, errors: ok ? null : v.errors };
}
`;
  fs.writeFileSync(esmPath, esm, "utf8");

  const hash = crypto.createHash("sha256").update(cjs).digest("hex");
  fs.writeFileSync(metaPath, JSON.stringify({ hash }, null, 2), "utf8");

  return { validatorsCjsPath: cjsPath, validatorsEsmPath: esmPath, hash };
}
