/**
 * Intersection type handling module.
 * Converts TypeScript intersection types to JSON Schema allOf constructs.
 */
import ts from "typescript";
import type { JsonSchema, SchemaContext } from "./types.js";
import { typeToJsonSchema } from "./typeToJsonSchema.js";

/**
 * Handles TypeScript intersection types and converts them to JSON Schema.
 * Tries to collapse branded intersections and builds named schemas for complex intersections.
 * 
 * @param type - The intersection type to convert
 * @param ctx - The schema generation context
 * @param typeNode - Optional type node for additional context
 * @returns The generated JSON Schema
 */
export function handleIntersection(
  type: ts.IntersectionType,
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
  return buildNamedSchema(type, ctx, typeNode, () => {
    const types = type.types;
    const brandCollapsed = tryCollapseBrandedIntersection(types, ctx, typeNode);
    if (brandCollapsed) {
      return brandCollapsed;
    }

    const allOf: JsonSchema[] = [];
    for (const t of types) {
      const schema = typeToJsonSchema(t, ctx);
      if (Object.keys(schema).length > 0) {
        if (isEmptyObjectSchema(schema)) {
          continue;
        }
        allOf.push(schema);
      }
    }

    if (allOf.length === 0) {
      return {};
    }

    if (allOf.length === 1) {
      return allOf[0];
    }

    return { allOf };
  });
}

/**
 * Attempts to collapse a branded intersection type to a simpler schema.
 * A branded intersection is one that combines a primitive type with a brand object type.
 * 
 * @param types - The constituent types of the intersection
 * @param ctx - The schema generation context
 * @param typeNode - Optional type node for additional context
 * @returns The simplified schema if collapse is possible, null otherwise
 */
export function tryCollapseBrandedIntersection(
  types: readonly ts.Type[],
  ctx: SchemaContext,
  _typeNode?: ts.TypeNode
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

/**
 * Checks if a TypeScript type represents a primitive type (string, number, boolean, bigint, or their literals).
 * 
 * @param t - The type to check
 * @returns True if the type is a primitive or primitive literal
 */
export function isPrimitiveLike(t: ts.Type): boolean {
  return (t.flags & (ts.TypeFlags.String | ts.TypeFlags.Number | ts.TypeFlags.Boolean | ts.TypeFlags.BigInt)) !== 0
    || (t.flags & ts.TypeFlags.StringLiteral) !== 0
    || (t.flags & ts.TypeFlags.NumberLiteral) !== 0;
}

/**
 * Checks if a TypeScript type represents a brand/billing object type.
 * Brand objects are simple objects with only brand-related properties like __brand or brand.
 * 
 * @param checker - TypeScript type checker
 * @param t - The type to check
 * @param _ctx - The schema generation context (unused)
 * @returns True if the type appears to be a brand object
 */
export function isBrandObject(checker: ts.TypeChecker, t: ts.Type, _ctx: SchemaContext): boolean {
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

function isEmptyObjectSchema(schema: JsonSchema): boolean {
  if (schema.type !== "object") {
    return false;
  }
  
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    if (!schema.additionalProperties) {
      return true;
    }
  }
  
  return false;
}

function buildNamedSchema(
  type: ts.Type,
  ctx: SchemaContext,
  typeNode: ts.TypeNode | undefined,
  build: () => JsonSchema
): JsonSchema {
  const name = getSchemaName(type, typeNode);
  if (!name) {
    return build();
  }

  const { components, typeStack } = ctx;
  if (components.has(name) || typeStack.has(type)) {
    return { $ref: `#/components/schemas/${name}` };
  }

  typeStack.add(type);
  const schema = build();
  typeStack.delete(type);

  if (!components.has(name)) {
    components.set(name, schema);
  }

  return { $ref: `#/components/schemas/${name}` };
}

function getSchemaName(type: ts.Type, typeNode?: ts.TypeNode): string | null {
  const aliasSymbol = (type as ts.TypeReference).aliasSymbol ?? (type as any).aliasSymbol;
  const aliasName = aliasSymbol?.getName();
  if (aliasName && aliasName !== "__type") {
    return aliasName;
  }

  const symbol = type.getSymbol();
  const symbolName = symbol?.getName?.();
  if (symbolName && symbolName !== "__type") {
    return symbolName;
  }

  const nodeName = getExplicitTypeNameFromNode(typeNode);
  if (nodeName && nodeName !== "__type") {
    return nodeName;
  }

  return null;
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
