/**
 * Union type handling module.
 * Converts TypeScript union types to JSON Schema anyOf/oneOf constructs.
 */
import ts from "typescript";
import type { JsonSchema, DiscriminatorObject, SchemaContext } from "./types.js";
import { typeToJsonSchema } from "./typeToJsonSchema.js";

/**
 * Handles TypeScript union types and converts them to JSON Schema.
 * Creates anyOf schemas with optional discriminator for union members.
 * 
 * @param type - The union type to convert
 * @param ctx - The schema generation context
 * @param typeNode - Optional type node for additional context
 * @returns The generated JSON Schema
 */
export function handleUnion(
  type: ts.UnionType,
  ctx: SchemaContext,
  typeNode?: ts.TypeNode
): JsonSchema {
  return buildNamedSchema(type, ctx, typeNode, () => {
    const types = type.types;
    const nullType = types.find(t => t.flags & ts.TypeFlags.Null);
    const undefinedType = types.find(t => t.flags & ts.TypeFlags.Undefined);
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

    const allBooleanLiterals = otherTypes.length > 0 && otherTypes.every(t => t.flags & ts.TypeFlags.BooleanLiteral);
    if (allBooleanLiterals) {
      const schema: JsonSchema = { type: "boolean" };
      if (nullType || undefinedType) {
        schema.type = ["boolean", "null"];
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
  });
}

/**
 * Detects if a union type forms a discriminated union.
 * A discriminated union has a common property with literal values that can be used for discrimination.
 * 
 * @param types - The constituent types of the union
 * @param ctx - The schema generation context
 * @param branches - The generated schemas for each branch (unused in current impl)
 * @returns Discriminator object if discriminated union detected, null otherwise
 */
export function detectDiscriminatedUnion(
  types: readonly ts.Type[],
  ctx: SchemaContext,
  _branches: JsonSchema[]
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

/**
 * Finds property names that are common across all types in a union.
 * 
 * @param checker - TypeScript type checker for property lookup
 * @param types - The types to analyze
 * @returns Array of property names present in all types
 */
export function findCommonPropertyNames(checker: ts.TypeChecker, types: readonly ts.Type[]): string[] {
  if (types.length === 0) return [];

  const firstProps = types[0].getProperties().map(s => s.getName());
  return firstProps.filter(name =>
    types.every(m => !!checker.getPropertyOfType(m, name))
  );
}

/**
 * Checks if a property is required (non-optional) in a given type.
 * 
 * @param checker - TypeScript type checker for symbol analysis
 * @param type - The type to check
 * @param propName - The property name to check
 * @returns True if the property is required
 */
export function isRequiredProperty(checker: ts.TypeChecker, type: ts.Type, propName: string): boolean {
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

/**
 * Gets the literal string values of a property across a type.
 * Used for detecting discriminated unions.
 * 
 * @param checker - TypeScript type checker for property type analysis
 * @param type - The type to check
 * @param propName - The property name to get values for
 * @returns Set of literal values, or null if not a literal union
 */
export function getPropertyLiteralValues(checker: ts.TypeChecker, type: ts.Type, propName: string): Set<string> | null {
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

/**
 * Checks if multiple sets are pairwise disjoint (have no common elements).
 * 
 * @param sets - Array of sets to check for disjointness
 * @returns True if all sets are pairwise disjoint
 */
export function areSetsDisjoint(sets: Array<Set<string>>): boolean {
  const seen = new Set<string>();
  for (const s of sets) {
    for (const v of s) {
      if (seen.has(v)) return false;
      seen.add(v);
    }
  }
  return true;
}

/**
 * Gets the schema name for a union branch type.
 * Used for discriminator mapping.
 * 
 * @param type - The type to get name for
 * @param ctx - The schema generation context
 * @returns The schema name, or generated anonymous name
 */
export function getBranchSchemaName(type: ts.Type, ctx: SchemaContext): string {
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
