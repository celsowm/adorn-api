/**
 * Primitive type handling module.
 * Converts TypeScript primitive types to JSON Schema.
 */
import ts from "typescript";
import type { JsonSchema, SchemaContext } from "./types.js";

/**
 * Handles TypeScript primitive types and converts them to JSON Schema.
 * Supports string, number, boolean, bigint, null, undefined, Date, and literal types.
 * 
 * @param type - The primitive type to convert
 * @param ctx - The schema generation context
 * @param typeNode - Optional type node for additional context
 * @returns The generated JSON Schema, or null if not a recognized primitive
 */
export function handlePrimitiveType(
  type: ts.Type,
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema | null {
  const { checker, propertyName } = ctx;

  if (type.flags & ts.TypeFlags.Undefined) {
    return {};
  }
  if (type.flags & ts.TypeFlags.Null) {
    return { type: "null" };
  }
  if (isDateType(type, checker)) {
    return { type: "string", format: "date-time" };
  }

  if (type.flags & ts.TypeFlags.String) {
    return { type: "string" };
  }
  if (type.flags & ts.TypeFlags.Number) {
    return normalizeNumericType(type, checker, typeNode, propertyName);
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

  return null;
}

/**
 * Checks if a TypeScript type represents a Date type.
 * Handles both direct Date references and aliased Date types.
 * 
 * @param type - The type to check
 * @param checker - TypeScript type checker for symbol resolution
 * @returns True if the type represents Date
 */
export function isDateType(type: ts.Type, checker: ts.TypeChecker): boolean {
  const symbol = type.getSymbol();
  const aliasSymbol = (type as any).aliasSymbol as ts.Symbol | undefined;
  if (aliasSymbol && (aliasSymbol.flags & ts.SymbolFlags.Alias)) {
    const aliased = checker.getAliasedSymbol(aliasSymbol);
    return aliased?.getName() === "Date";
  }

  if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) {
    const aliased = checker.getAliasedSymbol(symbol);
    return aliased?.getName() === "Date";
  }

  return symbol?.getName() === "Date";
}

/**
 * Checks if a TypeScript type represents a Set type.
 * 
 * @param type - The type to check
 * @param _checker - TypeScript type checker (unused)
 * @returns True if the type is a Set type
 */
export function isSetType(type: ts.Type, _checker: ts.TypeChecker): boolean {
  const symbol = type.getSymbol();
  if (!symbol) return false;
  const name = symbol.getName();
  if (name === "Set") return true;
  return false;
}

/**
 * Normalizes numeric types to either integer or number based on naming conventions.
 * Types named like "id", "page", "pageSize", etc. are converted to integer schema.
 * 
 * @param type - The numeric type to normalize
 * @param checker - TypeScript type checker for symbol resolution
 * @param typeNode - Optional type node for name extraction
 * @param propertyName - Optional property name for name-based inference
 * @returns The normalized numeric schema
 */
export function normalizeNumericType(type: ts.Type, checker: ts.TypeChecker, typeNode?: ts.TypeNode, propertyName?: string): JsonSchema {
  const typeName = getExplicitTypeNameFromNode(typeNode) ?? null;
  const symbol = getEffectiveSymbol(type, checker);
  const symbolName = symbol?.getName() ?? null;
  
  if (shouldBeIntegerType(typeName) || shouldBeIntegerType(symbolName) || shouldBeIntegerType(propertyName ?? null)) {
    return { type: "integer" };
  }
  
  return { type: "number" };
}

/**
 * Determines if a type should be represented as an integer based on its name.
 * Common patterns include "id", "page", "pageSize", "limit", etc.
 * 
 * @param typeName - The type or property name to check
 * @returns True if the name suggests an integer type
 */
export function shouldBeIntegerType(typeName: string | null): boolean {
  if (!typeName) return false;
  const lower = typeName.toLowerCase();
  return lower === "id" || 
         lower.endsWith("id") || 
         lower === "primarykey" || 
         lower === "pk" ||
         lower === "page" ||
         lower === "pagesize" ||
         lower === "totalitems" ||
         lower === "limit" ||
         lower === "offset";
}

/**
 * Extracts the explicit type name from a type reference node or type alias declaration.
 * 
 * @param typeNode - The type node to extract name from
 * @returns The extracted type name, or null if not found
 */
export function getExplicitTypeNameFromNode(typeNode?: ts.TypeNode): string | null {
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

/**
 * Gets the effective symbol for a type, resolving type aliases.
 * 
 * @param type - The type to get symbol from
 * @param checker - TypeScript type checker for alias resolution
 * @returns The effective symbol, or null if not found
 */
export function getEffectiveSymbol(type: ts.Type, checker: ts.TypeChecker): ts.Symbol | null {
  const aliasSymbol = (type as ts.TypeReference).aliasSymbol ?? (type as any).aliasSymbol;
  if (aliasSymbol && (aliasSymbol.flags & ts.SymbolFlags.Alias)) {
    return checker.getAliasedSymbol(aliasSymbol);
  }
  return type.getSymbol() ?? null;
}
