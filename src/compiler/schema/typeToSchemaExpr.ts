import type * as ts from 'typescript';

export type SchemaEmitContext = {
  ts: typeof ts;
  checker: ts.TypeChecker;
  vIdent: ts.Identifier;
  strictObjects: boolean;
  getOrCreateNamedSchema?: (t: ts.Type) => ts.Expression | undefined;
};

function call(tsi: typeof ts, expr: ts.Expression, name: string, args: ts.Expression[] = []) {
  return tsi.factory.createCallExpression(
    tsi.factory.createPropertyAccessExpression(expr, name),
    undefined,
    args,
  );
}

function isNullType(tsi: typeof ts, t: ts.Type): boolean {
  return (t.flags & tsi.TypeFlags.Null) !== 0;
}

function isUndefinedType(tsi: typeof ts, t: ts.Type): boolean {
  return (t.flags & tsi.TypeFlags.Undefined) !== 0;
}

function isVoidType(tsi: typeof ts, t: ts.Type): boolean {
  return (t.flags & tsi.TypeFlags.Void) !== 0;
}

function splitUnion(tsi: typeof ts, t: ts.Type): ts.Type[] | undefined {
  if ((t.flags & tsi.TypeFlags.Union) === 0) return undefined;
  const u = t as ts.UnionType;
  return u.types;
}

function literalExpr(tsi: typeof ts, v: string | number | boolean | null): ts.Expression {
  if (v === null) return tsi.factory.createNull();
  if (typeof v === 'string') return tsi.factory.createStringLiteral(v);
  if (typeof v === 'number') return tsi.factory.createNumericLiteral(v);
  return v ? tsi.factory.createTrue() : tsi.factory.createFalse();
}

function sanitizeTypeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function emitSchemaExprForType(type: ts.Type, ctx: SchemaEmitContext): ts.Expression | undefined {
  const tsi = ctx.ts;
  const checker = ctx.checker;
  const v = ctx.vIdent;

  const sym = type.getSymbol?.();
  const symName = sym?.getName?.();
  if (symName && symName !== '__type') {
    const hoisted = ctx.getOrCreateNamedSchema?.(type);
    if (hoisted) return hoisted;
  }

  if (type.isLiteral?.()) {
    const lit = (type as ts.LiteralType).value;
    if (lit === null) return call(tsi, v, 'literal', [tsi.factory.createNull()]);
    if (typeof lit === 'string' || typeof lit === 'number' || typeof lit === 'boolean') {
      return call(tsi, v, 'literal', [literalExpr(tsi, lit)]);
    }
  }

  const unionParts = splitUnion(tsi, type);
  if (unionParts) {
    const hasNull = unionParts.some((t) => isNullType(tsi, t));
    const hasUndef = unionParts.some((t) => isUndefinedType(tsi, t) || isVoidType(tsi, t));

    const filtered = unionParts.filter((t) => !isNullType(tsi, t) && !isUndefinedType(tsi, t) && !isVoidType(tsi, t));
    if (filtered.length === 0) return undefined;

    let base: ts.Expression | undefined;
    if (filtered.length === 1) {
      base = emitSchemaExprForType(filtered[0], ctx);
    } else {
      const parts = filtered.map((t) => emitSchemaExprForType(t, ctx)).filter(Boolean) as ts.Expression[];
      if (parts.length !== filtered.length) return undefined;
      base = call(tsi, v, 'union', parts);
    }

    if (!base) return undefined;

    if (hasNull) base = call(tsi, base, 'nullable');
    if (hasUndef) base = call(tsi, base, 'optional');
    return base;
  }

  if (type.flags & tsi.TypeFlags.StringLike) return call(tsi, v, 'string');
  if (type.flags & tsi.TypeFlags.BooleanLike) return call(tsi, v, 'boolean');
  if (type.flags & tsi.TypeFlags.NumberLike) return call(tsi, v, 'number');

  if (checker.isArrayType(type)) {
    const arrayType = type as ts.TypeReference;
    const elem = (arrayType.typeArguments ?? [])[0];
    if (!elem) return undefined;
    const itemExpr = emitSchemaExprForType(elem, ctx);
    if (!itemExpr) return undefined;
    return call(tsi, v, 'array', [itemExpr]);
  }

  if ((type.flags & tsi.TypeFlags.Object) !== 0) {
    const props = checker.getPropertiesOfType(type);
    const assignments: ts.PropertyAssignment[] = [];

    for (const p of props) {
      const decl = p.valueDeclaration ?? p.declarations?.[0];
      if (!decl) continue;

      const pType = checker.getTypeOfSymbolAtLocation(p, decl);
      let propSchema = emitSchemaExprForType(pType, ctx);
      if (!propSchema) return undefined;

      const isOptional = (p.flags & tsi.SymbolFlags.Optional) !== 0;
      if (isOptional) propSchema = call(tsi, propSchema, 'optional');

      assignments.push(
        tsi.factory.createPropertyAssignment(
          tsi.factory.createIdentifier(p.getName()),
          propSchema,
        ),
      );
    }

    const shape = tsi.factory.createObjectLiteralExpression(assignments, true);
    let objExpr: ts.Expression = call(tsi, v, 'object', [shape]);

    if (ctx.strictObjects) {
      objExpr = call(tsi, objExpr, 'strict');
    }

    if (symName && symName !== '__type') {
      objExpr = call(tsi, v, 'named', [tsi.factory.createStringLiteral(sanitizeTypeName(symName)), objExpr]);
    }

    return objExpr;
  }

  return undefined;
}
