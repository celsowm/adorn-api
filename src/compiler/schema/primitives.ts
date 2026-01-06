import ts from "typescript";
import type { JsonSchema, SchemaContext } from "./types.js";

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

export function isSetType(type: ts.Type, _checker: ts.TypeChecker): boolean {
  const symbol = type.getSymbol();
  if (!symbol) return false;
  const name = symbol.getName();
  if (name === "Set") return true;
  return false;
}

export function normalizeNumericType(type: ts.Type, checker: ts.TypeChecker, typeNode?: ts.TypeNode, propertyName?: string): JsonSchema {
  const typeName = getExplicitTypeNameFromNode(typeNode) ?? null;
  const symbol = getEffectiveSymbol(type, checker);
  const symbolName = symbol?.getName() ?? null;
  
  if (shouldBeIntegerType(typeName) || shouldBeIntegerType(symbolName) || shouldBeIntegerType(propertyName ?? null)) {
    return { type: "integer" };
  }
  
  return { type: "number" };
}

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

export function getEffectiveSymbol(type: ts.Type, checker: ts.TypeChecker): ts.Symbol | null {
  const aliasSymbol = (type as ts.TypeReference).aliasSymbol ?? (type as any).aliasSymbol;
  if (aliasSymbol && (aliasSymbol.flags & ts.SymbolFlags.Alias)) {
    return checker.getAliasedSymbol(aliasSymbol);
  }
  return type.getSymbol() ?? null;
}
