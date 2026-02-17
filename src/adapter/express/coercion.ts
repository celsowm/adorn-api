import type { DtoConstructor } from "../../core/types";
import { getDtoMeta, type InputMeta } from "../../core/metadata";
import type {
  SchemaNode,
  SchemaSource,
  StringSchema,
  ArraySchema,
  NumberSchema,
  ObjectSchema,
  RecordSchema,
  RefSchema,
  UnionSchema
} from "../../core/schema";
import { coerce } from "../../core/coerce";
import { HttpError } from "../../core/errors";
import type { InputCoercionMode } from "./types";

export type InputLocation = "params" | "query" | "body";

interface CoerceInputOptions {
  mode: InputCoercionMode;
  location: InputLocation;
}

interface CoerceField {
  name: string;
  schema: SchemaNode;
}

interface CoerceResult {
  value: unknown;
  invalidFields: string[];
}

interface CoerceOutcome {
  value: unknown;
  ok: boolean;
  changed: boolean;
}

/**
 * Creates an input coercer function for the given input metadata.
 */
export function createInputCoercer<T extends Record<string, unknown> = Record<string, unknown>>(
  input: InputMeta | undefined,
  options: CoerceInputOptions
): ((value: T) => T) | undefined {
  if (!input) {
    return undefined;
  }
  const fields = extractFields(input.schema);
  if (!fields.length) {
    return undefined;
  }
  return (value: T): T => {
    const result = coerceRecord(value, fields, options.mode);
    if (options.mode === "strict" && result.invalidFields.length) {
      throw new HttpError(400, buildInvalidMessage(options.location, result.invalidFields));
    }
    return result.value as T;
  };
}

function coerceRecord(
  value: unknown,
  fields: CoerceField[],
  mode: InputCoercionMode
): CoerceResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { value, invalidFields: [] };
  }
  const input = value as Record<string, unknown>;
  let changed = false;
  const output: Record<string, unknown> = { ...input };
  const invalidFields: string[] = [];
  for (const field of fields) {
    if (!(field.name in input)) {
      continue;
    }
    const original = input[field.name];
    const result = coerceValue(original, field.schema, mode);
    if (!result.ok && mode === "strict") {
      invalidFields.push(field.name);
    }
    if (result.changed) {
      output[field.name] = result.value;
      changed = true;
    }
  }
  return { value: changed ? output : value, invalidFields };
}

function coerceValue(
  value: unknown,
  schema: SchemaNode,
  mode: InputCoercionMode
): CoerceOutcome {
  switch (schema.kind) {
    case "integer":
      return coerceNumber(value, schema, true);
    case "number":
      return coerceNumber(value, schema, false);
    case "boolean": {
      return coerceBoolean(value);
    }
    case "string": {
      return coerceString(value, schema);
    }
    case "array":
      return coerceArrayValue(value, schema, mode);
    case "object":
      return coerceObjectValue(value, schema, mode);
    case "record":
      return coerceRecordValue(value, schema, mode);
    case "ref":
      return coerceRefValue(value, schema, mode);
    case "union":
      return coerceUnionValue(value, schema, mode);
    default:
      return { value, ok: true, changed: false };
  }
}

function coerceNumber(value: unknown, schema: NumberSchema, integer: boolean): CoerceOutcome {
  if (!isPresent(value)) {
    return { value, ok: true, changed: false };
  }
  const parsed = integer
    ? coerce.integer(value, { min: schema.minimum, max: schema.maximum })
    : coerce.number(value, { min: schema.minimum, max: schema.maximum });
  if (parsed === undefined) {
    return { value, ok: false, changed: false };
  }
  if (schema.exclusiveMinimum !== undefined && parsed <= schema.exclusiveMinimum) {
    return { value, ok: false, changed: false };
  }
  if (schema.exclusiveMaximum !== undefined && parsed >= schema.exclusiveMaximum) {
    return { value, ok: false, changed: false };
  }
  return { value: parsed, ok: true, changed: parsed !== value };
}

function coerceBoolean(value: unknown): CoerceOutcome {
  if (!isPresent(value)) {
    return { value, ok: true, changed: false };
  }
  const parsed = coerce.boolean(value);
  if (parsed === undefined) {
    return { value, ok: false, changed: false };
  }
  return { value: parsed, ok: true, changed: parsed !== value };
}

function coerceString(value: unknown, schema: StringSchema): CoerceOutcome {
  if (!isPresent(value)) {
    return { value, ok: true, changed: false };
  }
  if (schema.format === "date" || schema.format === "date-time") {
    const parsed = parseDateValue(value);
    if (!parsed) {
      return { value, ok: false, changed: false };
    }
    return { value: parsed, ok: true, changed: parsed !== value };
  }
  const parsed = coerce.string(value);
  if (parsed === undefined) {
    return { value, ok: true, changed: false };
  }
  return { value: parsed, ok: true, changed: parsed !== value };
}

function parseDateValue(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const text = coerce.string(value);
  if (text === undefined) {
    return undefined;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

function coerceArrayValue(
  value: unknown,
  schema: ArraySchema,
  mode: InputCoercionMode
): CoerceOutcome {
  if (value === undefined || value === null) {
    return { value, ok: true, changed: false };
  }
  let input: unknown[];
  let changed: boolean;
  if (Array.isArray(value)) {
    input = value;
    changed = false;
  } else if (typeof value === "string" && value.includes(",")) {
    input = value.split(",").map((s) => s.trim());
    changed = true;
  } else {
    input = [value];
    changed = true;
  }
  let ok = true;
  const output = input.map((entry) => {
    const result = coerceValue(entry, schema.items, mode);
    if (!result.ok) {
      ok = false;
    }
    if (result.changed) {
      changed = true;
    }
    return result.value;
  });
  return { value: changed ? output : value, ok, changed };
}

function coerceObjectValue(
  value: unknown,
  schema: ObjectSchema,
  mode: InputCoercionMode
): CoerceOutcome {
  if (value === undefined || value === null) {
    return { value, ok: true, changed: false };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { value, ok: mode === "safe", changed: false };
  }
  const properties = schema.properties ?? {};
  const fields = Object.entries(properties).map(([name, fieldSchema]) => ({
    name,
    schema: fieldSchema
  }));
  if (!fields.length) {
    return { value, ok: true, changed: false };
  }
  const result = coerceRecord(value, fields, mode);
  return {
    value: result.value,
    ok: result.invalidFields.length === 0,
    changed: result.value !== value
  };
}

function coerceRecordValue(
  value: unknown,
  schema: RecordSchema,
  mode: InputCoercionMode
): CoerceOutcome {
  if (value === undefined || value === null) {
    return { value, ok: true, changed: false };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { value, ok: mode === "safe", changed: false };
  }
  const input = value as Record<string, unknown>;
  let changed = false;
  let ok = true;
  const output: Record<string, unknown> = { ...input };
  for (const [key, entry] of Object.entries(input)) {
    const result = coerceValue(entry, schema.values, mode);
    if (!result.ok) {
      ok = false;
    }
    if (result.changed) {
      output[key] = result.value;
      changed = true;
    }
  }
  return { value: changed ? output : value, ok, changed };
}

function coerceRefValue(
  value: unknown,
  schema: RefSchema,
  mode: InputCoercionMode
): CoerceOutcome {
  if (value === undefined || value === null) {
    return { value, ok: true, changed: false };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { value, ok: mode === "safe", changed: false };
  }
  const meta = getDtoMetaSafe(schema.dto);
  const fields = Object.entries(meta.fields).map(([name, field]) => ({
    name,
    schema: field.schema
  }));
  if (!fields.length) {
    return { value, ok: true, changed: false };
  }
  const result = coerceRecord(value, fields, mode);
  return {
    value: result.value,
    ok: result.invalidFields.length === 0,
    changed: result.value !== value
  };
}

function coerceUnionValue(
  value: unknown,
  schema: UnionSchema,
  mode: InputCoercionMode
): CoerceOutcome {
  let fallback: CoerceOutcome | undefined;
  for (const option of schema.anyOf) {
    const result = coerceValue(value, option, mode);
    if (!result.ok) {
      continue;
    }
    if (result.changed) {
      return result;
    }
    fallback ??= result;
  }
  if (fallback) {
    return fallback;
  }
  return { value, ok: mode === "safe", changed: false };
}

function extractFields(schema: SchemaSource): CoerceField[] {
  if (isSchemaNode(schema)) {
    if (schema.kind === "object" && schema.properties) {
      return Object.entries(schema.properties).map(([name, fieldSchema]) => ({
        name,
        schema: fieldSchema
      }));
    }
    return [];
  }
  const meta = getDtoMetaSafe(schema);
  return Object.entries(meta.fields).map(([name, field]) => ({
    name,
    schema: field.schema
  }));
}

function getDtoMetaSafe(dto: DtoConstructor): {
  fields: Record<string, { schema: SchemaNode }>;
} {
  const meta = getDtoMeta(dto);
  if (!meta) {
    throw new Error(`DTO "${dto.name}" is missing @Dto decorator.`);
  }
  return meta;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return !!value && typeof value === "object" && "kind" in (value as SchemaNode);
}

function isPresent(value: unknown): boolean {
  return coerce.string(value) !== undefined;
}

function buildInvalidMessage(location: InputLocation, fields: string[]): string {
  let label = "query parameter";
  if (location === "params") {
    label = "path parameter";
  } else if (location === "body") {
    label = "request body field";
  }
  const suffix = fields.length > 1 ? "s" : "";
  return `Invalid ${label}${suffix}: ${fields.join(", ")}.`;
}
