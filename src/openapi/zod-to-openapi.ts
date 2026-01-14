import { z } from "zod";

export function zodToOpenApi(schema: z.ZodType<any>): any {
  return convertZodType(schema);
}

function convertZodType(schema: z.ZodType<any>): any {
  if (!schema || !schema._def) {
    return { type: "object" };
  }

  const def = schema._def as any;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodString":
      return convertZodString(def);

    case "ZodNumber":
      return convertZodNumber(def);

    case "ZodBoolean":
      return { type: "boolean" };

    case "ZodArray":
      return {
        type: "array",
        items: convertZodType(def.type),
      };

    case "ZodObject":
      return convertZodObject(schema as z.ZodObject<any>);

    case "ZodOptional":
      return convertZodType(def.innerType);

    case "ZodNullable":
      const inner = convertZodType(def.innerType);
      if (inner?.type) {
        const types = Array.isArray(inner.type) ? inner.type : [inner.type];
        return { ...inner, type: [...new Set([...types, "null"])] };
      }
      return { anyOf: [inner, { type: "null" }] };

    case "ZodDefault":
      const defaultSchema = convertZodType(def.innerType);
      defaultSchema.default = def.defaultValue();
      return defaultSchema;

    case "ZodEnum":
      return {
        type: "string",
        enum: def.values,
      };

    case "ZodLiteral":
      return {
        type: typeof def.value,
        enum: [def.value],
      };

    case "ZodUnion":
      return {
        oneOf: def.options.map((opt: z.ZodType<any>) => convertZodType(opt)),
      };

    case "ZodEffects":
      return convertZodType(def.schema);

    case "ZodDate":
      return { type: "string", format: "date-time" };

    case "ZodAny":
      return {};

    case "ZodRecord":
      return {
        type: "object",
        additionalProperties: convertZodType(def.valueType),
      };

    case "ZodTuple":
      return {
        type: "array",
        items: def.items.map((item: z.ZodType<any>) => convertZodType(item)),
        minItems: def.items.length,
        maxItems: def.items.length,
      };

    default:
      return { type: "object" };
  }
}

function convertZodString(def: any): any {
  const result: any = { type: "string" };

  if (def.checks) {
    for (const check of def.checks) {
      switch (check.kind) {
        case "email":
          result.format = "email";
          break;
        case "url":
          result.format = "uri";
          break;
        case "uuid":
          result.format = "uuid";
          break;
        case "datetime":
          result.format = "date-time";
          break;
        case "min":
          result.minLength = check.value;
          break;
        case "max":
          result.maxLength = check.value;
          break;
        case "regex":
          result.pattern = check.regex.source;
          break;
      }
    }
  }

  return result;
}

function convertZodNumber(def: any): any {
  const result: any = { type: "number" };

  if (!def.checks) {
    return result;
  }

  const hasInt = def.checks.some((c: any) => c.kind === "int");
  const hasPositive = def.checks.some((c: any) => c.kind === "positive");
  const hasNegative = def.checks.some((c: any) => c.kind === "negative");
  const hasMin = def.checks.some((c: any) => c.kind === "min");
  const hasMax = def.checks.some((c: any) => c.kind === "max");

  if (hasInt) {
    result.type = "integer";
  }

  if (hasPositive) {
    result.exclusiveMinimum = 0;
    if (hasInt) {
      result.type = "integer";
    }
    return result;
  }

  if (hasNegative) {
    result.exclusiveMaximum = 0;
    if (hasInt) {
      result.type = "integer";
    }
    return result;
  }

  if (hasMin) {
    const minCheck = def.checks.find((c: any) => c.kind === "min");
    if (minCheck && !minCheck.inclusive) {
      result.exclusiveMinimum = minCheck.value;
    } else {
      result.minimum = minCheck.value;
    }
  }

  if (hasMax) {
    const maxCheck = def.checks.find((c: any) => c.kind === "max");
    if (maxCheck && !maxCheck.inclusive) {
      result.exclusiveMaximum = maxCheck.value;
    } else {
      result.maximum = maxCheck.value;
    }
  }

  return result;
}

function convertZodObject(schema: z.ZodObject<any>): any {
  const shape = schema.shape;
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodValue = value as z.ZodType<any>;
    properties[key] = convertZodType(zodValue);

    if (!isOptional(zodValue)) {
      required.push(key);
    }
  }

  const result: any = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    result.required = required;
  }

  return result;
}

export function isOptional(schema: z.ZodType<any>): boolean {
  if (!schema || !schema._def) return false;
  const def = schema._def as any;
  const typeName = def.typeName as string;
  if (typeName === "ZodOptional") return true;
  if (typeName === "ZodDefault") return true;
  if (typeName === "ZodNullable") return isOptional(def.innerType);
  return false;
}
