import ts from "typescript";

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number | boolean)[];
  $ref?: string;
  nullable?: boolean;
  description?: string;
  default?: unknown;
  examples?: unknown[];
  example?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  discriminator?: DiscriminatorObject;
  additionalProperties?: boolean | JsonSchema;
  unevaluatedProperties?: boolean | JsonSchema;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  multipleOf?: number;
  const?: unknown;
  uniqueItems?: boolean;
  title?: string;
}

export interface DiscriminatorObject {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface SchemaContext {
  checker: ts.TypeChecker;
  components: Map<string, JsonSchema>;
  typeStack: Set<ts.Type>;
  typeNameStack: string[];
}

export function typeToJsonSchema(
  type: ts.Type,
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
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
  if (type.flags & ts.TypeFlags.BigInt) {
    return {
      type: "string",
      format: "int64",
      pattern: "^-?\\d+$"
    };
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
    return handleUnion(type.types, ctx, typeNode);
  }

  if (type.isIntersection()) {
    return handleIntersection(type.types, ctx, typeNode);
  }

  if (checker.isArrayType(type)) {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    const itemType = typeArgs?.[0];
    const items = itemType ? typeToJsonSchema(itemType, ctx) : {};
    return {
      type: "array",
      items,
      uniqueItems: isSetType(type, checker) ? true : undefined,
    };
  }

  if (type.flags & ts.TypeFlags.Object) {
    return handleObjectType(type as ts.ObjectType, ctx, typeNode);
  }

  return {};
}

function isSetType(type: ts.Type, checker: ts.TypeChecker): boolean {
  const symbol = type.getSymbol();
  if (!symbol) return false;
  const name = symbol.getName();
  if (name === "Set") return true;
  return false;
}

function handleUnion(
  types: readonly ts.Type[],
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
  const nullType = types.find(t => t.flags & ts.TypeFlags.Null);
  const otherTypes = types.filter(t => !(t.flags & ts.TypeFlags.Null) && !(t.flags & ts.TypeFlags.Undefined));

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

  if (otherTypes.length > 1) {
    const branches = otherTypes.map(t => typeToJsonSchema(t, ctx));
    const hasNull = !!nullType;

    const result: JsonSchema = {};

    if (hasNull) {
      result.anyOf = [...branches, { type: "null" }];
    } else {
      result.anyOf = branches;
    }

    const discriminatorResult = detectDiscriminatedUnion(otherTypes, ctx, branches);
    if (discriminatorResult) {
      result.oneOf = branches;
      result.discriminator = discriminatorResult;
    }

    return result;
  }

  if (otherTypes.length === 1) {
    return typeToJsonSchema(otherTypes[0], ctx);
  }

  return {};
}

function handleIntersection(
  types: readonly ts.Type[],
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
  const brandCollapsed = tryCollapseBrandedIntersection(types, ctx, typeNode);
  if (brandCollapsed) {
    return brandCollapsed;
  }

  const allOf: JsonSchema[] = [];
  for (const t of types) {
    allOf.push(typeToJsonSchema(t, ctx));
  }

  return { allOf };
}

function tryCollapseBrandedIntersection(
  types: readonly ts.Type[],
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema | null {
  const { checker } = ctx;
  const parts = [...types];

  const prim = parts.find(isPrimitiveLike);
  if (!prim) return null;

  const rest = parts.filter(p => p !== prim);
  if (rest.every(r => isBrandObject(checker, r, ctx))) {
    return typeToJsonSchema(prim, ctx);
  }

  return null;
}

function isPrimitiveLike(t: ts.Type): boolean {
  return (t.flags & (ts.TypeFlags.String | ts.TypeFlags.Number | ts.TypeFlags.Boolean | ts.TypeFlags.BigInt)) !== 0
    || (t.flags & ts.TypeFlags.StringLiteral) !== 0
    || (t.flags & ts.TypeFlags.NumberLiteral) !== 0;
}

function isBrandObject(checker: ts.TypeChecker, t: ts.Type, ctx: SchemaContext): boolean {
  if (!(t.flags & ts.TypeFlags.Object)) return false;

  const props = t.getProperties();
  if (props.length === 0) return false;

  const allowed = new Set(["__brand", "__type", "__tag", "brand"]);
  for (const p of props) {
    if (!allowed.has(p.getName())) return false;
  }

  const callSigs = (t as ts.ObjectType).getCallSignatures?.();
  if (callSigs && callSigs.length > 0) return false;

  const constructSigs = (t as ts.ObjectType).getConstructSignatures?.();
  if (constructSigs && constructSigs.length > 0) return false;

  return true;
}

function detectDiscriminatedUnion(
  types: readonly ts.Type[],
  ctx: SchemaContext,
  branches: JsonSchema[]
): DiscriminatorObject | null {
  if (types.length < 2) return null;

  const candidates = findCommonPropertyNames(ctx.checker, types);
  for (const propName of candidates) {
    const requiredInAll = types.every(t => isRequiredProperty(ctx.checker, t, propName));
    if (!requiredInAll) continue;

    const literalSets = types.map(t => getPropertyLiteralValues(ctx.checker, t, propName));
    if (literalSets.some(s => s === null)) continue;

    const allSets = literalSets as Array<Set<string>>;
    if (!areSetsDisjoint(allSets)) continue;

    const mapping: Record<string, string> = {};
    for (let i = 0; i < types.length; i++) {
      const branchName = getBranchSchemaName(types[i], ctx);
      for (const val of allSets[i]) {
        mapping[val] = `#/components/schemas/${branchName}`;
      }
    }

    return { propertyName: propName, mapping };
  }

  return null;
}

function findCommonPropertyNames(checker: ts.TypeChecker, types: readonly ts.Type[]): string[] {
  if (types.length === 0) return [];

  const firstProps = types[0].getProperties().map(s => s.getName());
  return firstProps.filter(name =>
    types.every(m => !!checker.getPropertyOfType(m, name))
  );
}

function isRequiredProperty(checker: ts.TypeChecker, type: ts.Type, propName: string): boolean {
  const sym = checker.getPropertyOfType(type, propName);
  if (!sym) return false;

  if (sym.flags & ts.SymbolFlags.Optional) return false;

  const propType = checker.getTypeOfSymbol(sym);
  if (propType.isUnion?.()) {
    const hasUndefined = propType.types.some(t => (t.flags & ts.TypeFlags.Undefined) !== 0);
    if (hasUndefined) return false;
  }

  return true;
}

function getPropertyLiteralValues(checker: ts.TypeChecker, type: ts.Type, propName: string): Set<string> | null {
  const sym = checker.getPropertyOfType(type, propName);
  if (!sym) return null;

  const propType = checker.getTypeOfSymbol(sym);

  if (propType.isStringLiteral?.()) {
    return new Set([(propType as ts.StringLiteralType).value]);
  }

  if (propType.isUnion?.()) {
    const values = new Set<string>();
    for (const m of propType.types) {
      if (!m.isStringLiteral?.()) return null;
      values.add((m as ts.StringLiteralType).value);
    }
    return values;
  }

  return null;
}

function areSetsDisjoint(sets: Array<Set<string>>): boolean {
  const seen = new Set<string>();
  for (const s of sets) {
    for (const v of s) {
      if (seen.has(v)) return false;
      seen.add(v);
    }
  }
  return true;
}

function getBranchSchemaName(type: ts.Type, ctx: SchemaContext): string {
  const symbol = type.getSymbol();
  if (symbol) {
    return symbol.getName();
  }

  const aliasSymbol = (type as any).aliasSymbol;
  if (aliasSymbol) {
    return aliasSymbol.getName();
  }

  return `Anonymous_${ctx.typeNameStack.length}`;
}

function handleObjectType(
  type: ts.ObjectType,
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
  const { checker, components } = ctx;
  const symbol = type.getSymbol();
  const typeName = symbol?.getName?.() ?? getTypeNameFromNode(typeNode, ctx);

  if (typeName && typeName !== "__type") {
    const typeId = getTypeId(type, typeName);

    if (ctx.typeStack.has(type)) {
      return { $ref: `#/components/schemas/${typeName}` };
    }

    ctx.typeStack.add(type);
    ctx.typeNameStack.push(typeName);

    if (components.has(typeName)) {
      ctx.typeStack.delete(type);
      ctx.typeNameStack.pop();
      return { $ref: `#/components/schemas/${typeName}` };
    }
  }

  const schema = buildObjectSchema(type, ctx, typeNode);

  if (typeName && typeName !== "__type" && !components.has(typeName)) {
    components.set(typeName, schema);
    ctx.typeStack.delete(type);
    ctx.typeNameStack.pop();
    return { $ref: `#/components/schemas/${typeName}` };
  }

  ctx.typeStack.delete(type);
  ctx.typeNameStack.pop();

  return schema;
}

function getTypeId(type: ts.Type, typeName: string): string {
  const typeFlags = type.flags.toString();
  return `${typeName}_${typeFlags}`;
}

function getTypeNameFromNode(typeNode: ts.TypeNode | undefined, ctx: SchemaContext): string {
  if (!typeNode) return `Anonymous_${ctx.typeNameStack.length}`;

  if (ts.isTypeReferenceNode(typeNode)) {
    if (ts.isIdentifier(typeNode.typeName)) {
      return typeNode.typeName.text;
    }
  }

  if (ts.isTypeAliasDeclaration(typeNode.parent)) {
    if (ts.isIdentifier(typeNode.parent.name)) {
      return typeNode.parent.name.text;
    }
  }

  return `Anonymous_${ctx.typeNameStack.length}`;
}

function buildObjectSchema(
  type: ts.ObjectType,
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
  const { checker } = ctx;

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

  if (isRecordType(type, checker)) {
    const valueType = getRecordValueType(type, checker);
    if (valueType) {
      schema.additionalProperties = typeToJsonSchema(valueType, ctx);
    }
  }

  return schema;
}

function isRecordType(type: ts.ObjectType, checker: ts.TypeChecker): boolean {
  const symbol = type.getSymbol();
  if (!symbol) return false;

  const name = symbol.getName();
  if (name === "Record") return true;

  return false;
}

function getRecordValueType(type: ts.ObjectType, checker: ts.TypeChecker): ts.Type | null {
  const symbol = type.getSymbol();
  if (!symbol) return null;

  const name = symbol.getName();
  if (name === "Record") {
    const typeRef = type as ts.TypeReference;
    const typeArgs = typeRef.typeArguments;
    if (typeArgs && typeArgs.length >= 2) {
      return typeArgs[1];
    }
  }

  return null;
}

export function createSchemaContext(checker: ts.TypeChecker): SchemaContext {
  return {
    checker,
    components: new Map(),
    typeStack: new Set(),
    typeNameStack: [],
  };
}
