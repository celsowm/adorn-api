/**
 * Main type-to-JSON-Schema conversion module.
 * Routes different TypeScript types to appropriate handlers.
 */
import ts from "typescript";
import type { JsonSchema, SchemaContext } from "./types.js";
import { handlePrimitiveType } from "./primitives.js";
import { handleUnion } from "./unionHandler.js";
import { handleIntersection } from "./intersectionHandler.js";
import { handleObjectType, isMetalOrmWrapperType, handleMetalOrmWrapper } from "./objectHandler.js";

export type { JsonSchema, DiscriminatorObject, SchemaContext } from "./types.js";

/**
 * Converts a TypeScript type to a JSON Schema object.
 * This is the main entry point for schema generation, routing to appropriate type handlers.
 * 
 * @param type - The TypeScript type to convert
 * @param ctx - The schema generation context
 * @param typeNode - Optional type node for additional context
 * @returns The generated JSON Schema
 */
export function typeToJsonSchema(
  type: ts.Type,
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
  const primitiveResult = handlePrimitiveType(type, ctx, typeNode);
  if (primitiveResult) {
    return primitiveResult;
  }

  if (type.isUnion()) {
    return handleUnion(type, ctx, typeNode);
  }

  if (type.isIntersection()) {
    return handleIntersection(type, ctx, typeNode);
  }

  if (ctx.checker.isArrayType(type)) {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    const itemType = typeArgs?.[0];
    const items = itemType ? typeToJsonSchema(itemType, ctx) : {};
    return {
      type: "array",
      items,
      uniqueItems: isSetType(type, ctx.checker) ? true : undefined,
    };
  }

  if (type.flags & ts.TypeFlags.Object) {
    const objectType = type as ts.ObjectType;
    if (isMetalOrmWrapperType(type, ctx.checker)) {
      return handleMetalOrmWrapper(objectType, ctx);
    }
    return handleObjectType(objectType, ctx, typeNode);
  }

  return {};
}

/**
 * Creates a new schema generation context with fresh component registry and type stack.
 * 
 * @param checker - TypeScript type checker for type analysis
 * @param mode - Generation mode ("request" or "response"), defaults to "response"
 * @returns A new SchemaContext for schema generation
 */
export function createSchemaContext(checker: ts.TypeChecker, mode: "request" | "response" = "response"): SchemaContext {
  return {
    checker,
    components: new Map(),
    typeStack: new Set(),
    typeNameStack: [],
    mode,
  };
}

function isSetType(type: ts.Type, _checker: ts.TypeChecker): boolean {
  const symbol = type.getSymbol();
  if (!symbol) return false;
  const name = symbol.getName();
  if (name === "Set") return true;
  return false;
}
