import type { SchemaNode, SchemaSource } from "../../core/schema";
import type { DtoConstructor } from "../../core/types";
import { getDtoMeta } from "../../core/metadata";

export function serializeResponse(value: unknown, schema: SchemaSource): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (isSchemaNode(schema)) {
    return serializeWithSchema(value, schema);
  }
  return serializeWithDto(value, schema);
}

function serializeWithDto(value: unknown, dto: DtoConstructor): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeWithDto(entry, dto));
  }
  const plainValue = toPlainObject(value);
  if (!plainValue) {
    return value;
  }
  const meta = getDtoMeta(dto);
  if (!meta) {
    return plainValue;
  }
  const output: Record<string, unknown> = { ...plainValue };
  for (const [name, field] of Object.entries(meta.fields)) {
    if (name in plainValue) {
      output[name] = serializeWithSchema(plainValue[name], field.schema);
    }
  }
  return output;
}

function serializeWithSchema(value: unknown, schema: SchemaNode): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  switch (schema.kind) {
    case "string":
      return serializeString(value, schema.format);
    case "array":
      if (!Array.isArray(value)) {
        return value;
      }
      return value.map((entry) => serializeWithSchema(entry, schema.items));
    case "object":
      return serializeObject(value, schema.properties);
    case "record":
      if (!isPlainObject(value)) {
        return value;
      }
      return serializeRecord(value as Record<string, unknown>, schema.values);
    case "ref":
      return serializeWithDto(value, schema.dto);
    case "union":
      return serializeUnion(value, schema.anyOf);
    default:
      return value;
  }
}

function serializeString(value: unknown, format: string | undefined): unknown {
  if (format === "byte" && Buffer.isBuffer(value)) {
    return value.toString("base64");
  }
  if (!(value instanceof Date)) {
    return value;
  }
  if (Number.isNaN(value.getTime())) {
    return value;
  }
  if (format === "date") {
    return value.toISOString().slice(0, 10);
  }
  if (format === "date-time") {
    return value.toISOString();
  }
  return value;
}

function serializeObject(
  value: unknown,
  properties: Record<string, SchemaNode> | undefined
): unknown {
  const plainValue = toPlainObject(value);
  if (!plainValue) {
    return value;
  }
  const output: Record<string, unknown> = { ...plainValue };
  if (!properties) {
    return output;
  }
  for (const [key, schema] of Object.entries(properties)) {
    if (key in plainValue) {
      output[key] = serializeWithSchema(plainValue[key], schema);
    }
  }
  return output;
}

function serializeRecord(
  value: Record<string, unknown>,
  schema: SchemaNode
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...value };
  for (const [key, entry] of Object.entries(value)) {
    output[key] = serializeWithSchema(entry, schema);
  }
  return output;
}

function serializeUnion(value: unknown, options: SchemaNode[]): unknown {
  for (const option of options) {
    const serialized = serializeWithSchema(value, option);
    if (serialized !== value) {
      return serialized;
    }
  }
  return value;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return !!value && typeof value === "object" && "kind" in (value as SchemaNode);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function toPlainObject(value: unknown): Record<string, unknown> | null {
  // 1. Handle lazy-load wrappers (BelongsToReference)
  if (typeof value === "object" && typeof (value as Record<string, unknown>).load === "function") {
    const wrapper = value as { current: unknown; loaded: boolean; load: () => unknown };
    if (wrapper.current !== undefined && wrapper.current !== null) {
      return toPlainObject(wrapper.current);
    }
    if (wrapper.loaded) {
      return null;
    }
    return null;
  }
  // 2. Handle plain objects
  if (isPlainObject(value)) {
    return value;
  }
  // 3. Convert class instances to plain objects
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(value)) {
      if (key.startsWith('_') || key === 'constructor' || key === 'prototype') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && descriptor.enumerable) {
        const propertyValue = (value as Record<string, unknown>)[key];
        result[key] = propertyValue;
      }
    }
    return result;
  }
  return null;
}
