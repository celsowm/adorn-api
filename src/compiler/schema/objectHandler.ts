import ts from "typescript";
import type { JsonSchema, SchemaContext } from "./types.js";
import { typeToJsonSchema } from "./typeToJsonSchema.js";

export function handleObjectType(
  type: ts.ObjectType,
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
  const { checker, components, typeStack, mode } = ctx;
  const symbol = type.getSymbol();
  const typeName = symbol?.getName?.() ?? getTypeNameFromNode(typeNode, ctx);

  if (isMetalOrmWrapperType(type, checker)) {
    return handleMetalOrmWrapper(type, ctx);
  }

  if (typeName && typeName !== "__type") {
    if (components.has(typeName)) {
      return { $ref: "#/components/schemas/${typeName}" };
    }

    if (typeStack.has(type)) {
      return { $ref: "#/components/schemas/${typeName}" };
    }

    typeStack.add(type);
  }

  const schema = buildObjectSchema(type, ctx, typeNode);

  if (typeName && typeName !== "__type") {
    typeStack.delete(type);
    
    const existing = components.get(typeName);
    if (!existing) {
      components.set(typeName, schema);
    }
    return { $ref: "#/components/schemas/${typeName}" };
  }

  typeStack.delete(type);
  return schema;
}

export function buildObjectSchema(
  type: ts.ObjectType,
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
  const { checker, mode } = ctx;

  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  const props = checker.getPropertiesOfType(type);
  for (const prop of props) {
    const propName = prop.getName();
    
    if (isIteratorOrSymbolProperty(propName)) {
      continue;
    }
    
    const propType = checker.getTypeOfSymbol(prop);
    if (isMethodLike(propType)) {
      continue;
    }

    const isOptional = !!(prop.flags & ts.SymbolFlags.Optional);
    const isRelation = isMetalOrmWrapperType(propType, checker);
    
    properties[propName] = typeToJsonSchema(propType, ctx);

    const shouldRequire = mode === "response"
      ? !isRelation && !isOptional
      : !isOptional;
    
    if (shouldRequire) {
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

export function isRecordType(type: ts.ObjectType, checker: ts.TypeChecker): boolean {
  const symbol = type.getSymbol();
  if (!symbol) return false;

  const name = symbol.getName();
  if (name === "Record") return true;

  return false;
}

export function getRecordValueType(type: ts.ObjectType, checker: ts.TypeChecker): ts.Type | null {
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

export function isMetalOrmWrapperType(type: ts.Type, checker: ts.TypeChecker): boolean {
  return !!findMetalOrmWrapper(type, checker);
}

export function isMethodLike(type: ts.Type): boolean {
  const callSigs = type.getCallSignatures?.();
  return !!(callSigs && callSigs.length > 0);
}

export function isIteratorOrSymbolProperty(propName: string): boolean {
  return propName.startsWith("__@") || propName.startsWith("[") || propName === Symbol.iterator.toString();
}

export function getTypeNameFromNode(typeNode: ts.TypeNode | undefined, ctx: SchemaContext): string {
  const explicitName = getExplicitTypeNameFromNode(typeNode);
  if (explicitName) return explicitName;

  return "Anonymous_${ctx.typeNameStack.length}";
}

function getExplicitTypeNameFromNode(typeNode?: ts.TypeNode): string | null {
  if (!typeNode) return null;

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

  return null;
}

const METAL_ORM_WRAPPER_NAMES = ["HasManyCollection", "ManyToManyCollection", "BelongsToReference", "HasOneReference"];

interface MetalOrmWrapperInfo {
  wrapperName: string;
  targetTypeArgs: ReadonlyArray<ts.Type>;
  isReadonlyArray: boolean;
}

export function findMetalOrmWrapper(
  type: ts.Type,
  checker: ts.TypeChecker
): MetalOrmWrapperInfo | null {
  if (type.isIntersection()) {
    let wrapperInfo: MetalOrmWrapperInfo | null = null;
    let hasReadonlyArray = false;

    for (const constituent of (type as ts.IntersectionType).types) {
      const result = findWrapperInType(constituent, checker);
      if (result) {
        wrapperInfo = result;
      }
      if (!(constituent.flags & ts.TypeFlags.Object)) continue;
      const symbol = constituent.getSymbol();
      if (symbol?.getName() === "ReadonlyArray") {
        hasReadonlyArray = true;
      }
    }

    if (wrapperInfo) {
      return { ...wrapperInfo, isReadonlyArray: hasReadonlyArray };
    }
    return null;
  }

  return findWrapperInType(type, checker);
}

function findWrapperInType(type: ts.Type, checker: ts.TypeChecker): MetalOrmWrapperInfo | null {
  const aliasSymbol = (type as ts.TypeReference).aliasSymbol ?? (type as any).aliasSymbol;
  const symbol = type.getSymbol();
  const effectiveSymbol = (aliasSymbol && (aliasSymbol.flags & ts.SymbolFlags.Alias))
    ? checker.getAliasedSymbol(aliasSymbol)
    : symbol;

  if (!effectiveSymbol) return null;

  const name = effectiveSymbol.getName();
  if (!METAL_ORM_WRAPPER_NAMES.includes(name)) return null;

  const typeRef = type as ts.TypeReference;
  const typeArgs = typeRef.typeArguments || [];

  return {
    wrapperName: name,
    targetTypeArgs: typeArgs,
    isReadonlyArray: false,
  };
}

export function getWrapperTypeName(type: ts.Type, checker: ts.TypeChecker): string | null {
  const symbol = type.getSymbol();
  if (!symbol) return null;
  const name = symbol.getName();
  return METAL_ORM_WRAPPER_NAMES.includes(name) ? name : null;
}

export function handleMetalOrmWrapper(type: ts.ObjectType, ctx: SchemaContext): JsonSchema {
  const typeRef = type as ts.TypeReference;
  const typeArgs = typeRef.typeArguments;
  const targetType = typeArgs?.[0] ?? null;
  
  const wrapperName = getWrapperTypeName(type, ctx.checker);
  if (!wrapperName) return {};
  
  const wrapperRel: Record<string, unknown> = { wrapper: wrapperName };
  
  if (wrapperName === "HasManyCollection" || wrapperName === "ManyToManyCollection") {
    const items = targetType ? typeToJsonSchema(targetType, ctx) : {};
    if (wrapperName === "ManyToManyCollection" && typeArgs?.[1]) {
      wrapperRel.pivot = typeArgs[1];
    }
    
    return {
      type: "array",
      items,
      "x-metal-orm-rel": wrapperRel,
    };
  }
  
  const targetSchema = targetType ? typeToJsonSchema(targetType, ctx) : {};
  return {
    ...targetSchema,
    "x-metal-orm-rel": wrapperRel,
  };
}
