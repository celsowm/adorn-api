import ts from "typescript";

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number | boolean)[];
  $ref?: string;
  nullable?: boolean;
}

export interface SchemaContext {
  checker: ts.TypeChecker;
  components: Map<string, JsonSchema>;
}

export function typeToJsonSchema(type: ts.Type, ctx: SchemaContext): JsonSchema {
  const { checker } = ctx;

  if (type.flags & ts.TypeFlags.Undefined) {
    return {};
  }
  if (type.flags & ts.TypeFlags.Null) {
    return { type: "null" };
  }

  if (type.flags & ts.TypeFlags.String) {
    return { type: "string" };
  }
  if (type.flags & ts.TypeFlags.Number) {
    return { type: "number" };
  }
  if (type.flags & ts.TypeFlags.Boolean) {
    return { type: "boolean" };
  }

  if (type.flags & ts.TypeFlags.StringLiteral) {
    const value = (type as ts.StringLiteralType).value;
    return { type: "string", enum: [value] };
  }
  if (type.flags & ts.TypeFlags.NumberLiteral) {
    const value = (type as ts.NumberLiteralType).value;
    return { type: "number", enum: [value] };
  }
  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    const intrinsic = (type as any).intrinsicName;
    return { type: "boolean", enum: [intrinsic === "true"] };
  }

  if (type.isUnion()) {
    return handleUnion(type.types, ctx);
  }

  if (checker.isArrayType(type)) {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    const itemType = typeArgs?.[0];
    return {
      type: "array",
      items: itemType ? typeToJsonSchema(itemType, ctx) : {},
    };
  }

  if (type.flags & ts.TypeFlags.Object) {
    return handleObjectType(type as ts.ObjectType, ctx);
  }

  return {};
}

function handleUnion(types: readonly ts.Type[], ctx: SchemaContext): JsonSchema {
  const nullType = types.find(t => t.flags & ts.TypeFlags.Null);
  const otherTypes = types.filter(t => !(t.flags & ts.TypeFlags.Null));

  const allStringLiterals = otherTypes.every(t => t.flags & ts.TypeFlags.StringLiteral);
  if (allStringLiterals && otherTypes.length > 0) {
    const enumValues = otherTypes.map(t => (t as ts.StringLiteralType).value);
    const schema: JsonSchema = { type: "string", enum: enumValues };
    if (nullType) {
      schema.type = ["string", "null"];
    }
    return schema;
  }

  if (otherTypes.length === 1 && nullType) {
    const innerSchema = typeToJsonSchema(otherTypes[0], ctx);
    if (typeof innerSchema.type === "string") {
      innerSchema.type = [innerSchema.type, "null"];
    }
    return innerSchema;
  }

  if (otherTypes.length > 0) {
    return typeToJsonSchema(otherTypes[0], ctx);
  }

  return {};
}

function handleObjectType(type: ts.ObjectType, ctx: SchemaContext): JsonSchema {
  const { checker, components } = ctx;
  const symbol = type.getSymbol();
  const typeName = symbol?.getName();

  if (typeName && typeName !== "__type" && components.has(typeName)) {
    return { $ref: `#/components/schemas/${typeName}` };
  }

  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  const props = checker.getPropertiesOfType(type);
  for (const prop of props) {
    const propName = prop.getName();
    const propType = checker.getTypeOfSymbol(prop);
    const isOptional = !!(prop.flags & ts.SymbolFlags.Optional);

    properties[propName] = typeToJsonSchema(propType, ctx);

    if (!isOptional) {
      required.push(propName);
    }
  }

  const schema: JsonSchema = {
    type: "object",
    properties,
  };
  if (required.length > 0) {
    schema.required = required;
  }

  if (typeName && typeName !== "__type") {
    components.set(typeName, schema);
    return { $ref: `#/components/schemas/${typeName}` };
  }

  return schema;
}
