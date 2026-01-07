/**
 * Object type handling module.
 * Converts TypeScript object types and interfaces to JSON Schema.
 */
import ts from "typescript";
import type { JsonSchema, SchemaContext } from "./types.js";
import { typeToJsonSchema } from "./typeToJsonSchema.js";

/**
 * Handles TypeScript object types and converts them to JSON Schema.
 * Manages named schemas, component registration, and cycle detection.
 * 
 * @param type - The object type to convert
 * @param ctx - The schema generation context
 * @param typeNode - Optional type node for additional context
 * @returns The generated JSON Schema
 */
export function handleObjectType(
  type: ts.ObjectType,
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
  const { checker, components, typeStack } = ctx;
  const symbol = type.getSymbol();
  const typeName = symbol?.getName?.() ?? getTypeNameFromNode(typeNode, ctx);

  if (isMetalOrmWrapperType(type, checker)) {
    return handleMetalOrmWrapper(type, ctx);
  }

  if (typeName && typeName !== "__type") {
    const isMetalOrmGeneric = METAL_ORM_WRAPPER_NAMES.some(name => 
      typeName === name || typeName.endsWith("Api")
    );
    
    if (isMetalOrmGeneric) {
      return {};
    }
    
    if (components.has(typeName)) {
      return { $ref: `#/components/schemas/${typeName}` };
    }

    if (typeStack.has(type)) {
      return { $ref: `#/components/schemas/${typeName}` };
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
    return { $ref: `#/components/schemas/${typeName}` };
  }

  typeStack.delete(type);
  return schema;
}

/**
 * Builds the actual object schema from a TypeScript object type.
 * Extracts properties, handles required fields, and processes Record types.
 * 
 * @param type - The object type to convert
 * @param ctx - The schema generation context
 * @param typeNode - Optional type node for additional context
 * @returns The generated object schema
 */
export function buildObjectSchema(
  type: ts.ObjectType,
  ctx: SchemaContext,
  _typeNode?: ts.TypeNode
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
    
    const propCtx = { ...ctx, propertyName: propName };
    properties[propName] = typeToJsonSchema(propType, propCtx);

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

/**
 * Checks if a TypeScript type represents a Record type.
 * 
 * @param type - The type to check
 * @param _checker - TypeScript type checker (unused)
 * @returns True if the type is a Record type
 */
export function isRecordType(type: ts.ObjectType, _checker: ts.TypeChecker): boolean {
  const symbol = type.getSymbol();
  if (!symbol) return false;

  const name = symbol.getName();
  if (name === "Record") return true;

  return false;
}

/**
 * Extracts the value type from a Record type.
 * For Record<K, V>, returns V.
 * 
 * @param type - The Record type to extract from
 * @param _checker - TypeScript type checker (unused)
 * @returns The value type, or null if not a Record or has no type arguments
 */
export function getRecordValueType(type: ts.ObjectType, _checker: ts.TypeChecker): ts.Type | null {
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

/**
 * Checks if a type represents a Metal ORM wrapper type (e.g., HasManyCollection, BelongsToReference).
 * 
 * @param type - The type to check
 * @param checker - TypeScript type checker for symbol resolution
 * @returns True if the type is a Metal ORM wrapper
 */
export function isMetalOrmWrapperType(type: ts.Type, checker: ts.TypeChecker): boolean {
  return !!findMetalOrmWrapper(type, checker);
}

/**
 * Checks if a TypeScript type represents a callable/method-like type.
 * 
 * @param type - The type to check
 * @returns True if the type has call signatures (is callable)
 */
export function isMethodLike(type: ts.Type): boolean {
  const callSigs = type.getCallSignatures?.();
  return !!(callSigs && callSigs.length > 0);
}

/**
 * Checks if a property name represents an iterator or Symbol property that should be excluded.
 * 
 * @param propName - The property name to check
 * @returns True if the property should be excluded from schema generation
 */
export function isIteratorOrSymbolProperty(propName: string): boolean {
  return propName.startsWith("__@") || propName.startsWith("[") || propName === Symbol.iterator.toString();
}

/**
 * Gets the type name from a type node or generates an anonymous name.
 * 
 * @param typeNode - The type node to extract name from
 * @param _ctx - The schema generation context (unused)
 * @returns The type name or generated anonymous name
 */
export function getTypeNameFromNode(typeNode: ts.TypeNode | undefined, _ctx: SchemaContext): string {
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

/**
 * Finds and extracts information about a Metal ORM wrapper type within a type.
 * Handles both direct wrapper types and wrapper types within intersections.
 * 
 * @param type - The type to analyze
 * @param checker - TypeScript type checker for symbol resolution
 * @returns Wrapper info if found, null otherwise
 */
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

/**
 * Gets the name of a Metal ORM wrapper type if applicable.
 * 
 * @param type - The type to check
 * @param _checker - TypeScript type checker (unused)
 * @returns The wrapper type name if applicable, null otherwise
 */
export function getWrapperTypeName(type: ts.Type, _checker: ts.TypeChecker): string | null {
  const symbol = type.getSymbol();
  if (!symbol) return null;
  const name = symbol.getName();
  return METAL_ORM_WRAPPER_NAMES.includes(name) ? name : null;
}

/**
 * Handles Metal ORM wrapper types and converts them to appropriate JSON Schema.
 * Different wrapper types result in different schema structures.
 * 
 * @param type - The wrapper object type to convert
 * @param ctx - The schema generation context
 * @returns The generated JSON Schema for the wrapper
 */
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
  
  if (!targetType) {
    return { "x-metal-orm-rel": wrapperRel };
  }
  
  if (wrapperName === "BelongsToReference" || wrapperName === "HasOneReference") {
    return handleBelongsToReference(targetType, ctx, wrapperRel);
  }
  
  const targetSchema = typeToJsonSchema(targetType, ctx);
  return {
    ...targetSchema,
    "x-metal-orm-rel": wrapperRel,
  };
}

function handleBelongsToReference(targetType: ts.Type, ctx: SchemaContext, wrapperRel: Record<string, unknown>): JsonSchema {
  const { components } = ctx;
  
  const targetSymbol = targetType.getSymbol();
  const typeName = targetSymbol?.getName();
  
  if (!typeName) {
    return {
      type: "object",
      properties: {},
      "x-metal-orm-rel": wrapperRel,
    };
  }
  
  const refSchemaName = `${typeName}Ref`;
  
  if (components.has(refSchemaName)) {
    return { 
      $ref: `#/components/schemas/${refSchemaName}`,
      "x-metal-orm-rel": wrapperRel,
    };
  }
  
  const refSchema = buildRefSchema(targetType, ctx);
  components.set(refSchemaName, refSchema);
  
  return {
    $ref: `#/components/schemas/${refSchemaName}`,
    "x-metal-orm-rel": wrapperRel,
  };
}

function buildRefSchema(type: ts.Type, ctx: SchemaContext): JsonSchema {
  const { checker } = ctx;
  
  if (!(type.flags & ts.TypeFlags.Object)) {
    return { type: "object", properties: {} };
  }
  
  const objectType = type as ts.ObjectType;
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  
  const props = checker.getPropertiesOfType(objectType);
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
    
    if (isRelation) {
      continue;
    }
    
    const propCtx = { ...ctx, propertyName: propName };
    properties[propName] = typeToJsonSchema(propType, propCtx);
    
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
  
  return schema;
}
