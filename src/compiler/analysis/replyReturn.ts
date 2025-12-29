import type * as ts from 'typescript';

export type ReplyVariant = { status: number; body: ts.Type | undefined };

function isReplyType(type: ts.Type): type is ts.TypeReference {
  const sym = type.getSymbol?.();
  return !!sym && sym.getName?.() === 'Reply';
}

function literalNumbers(tsi: typeof ts, t: ts.Type): number[] {
  if (t.isUnion?.()) {
    const out: number[] = [];
    for (const x of (t as ts.UnionType).types) out.push(...literalNumbers(tsi, x));
    return out;
  }
  if ((t.flags & tsi.TypeFlags.NumberLiteral) !== 0) {
    const lit = t as ts.NumberLiteralType;
    return [lit.value];
  }
  return [];
}

export function extractReplyVariants(tsi: typeof ts, checker: ts.TypeChecker, type: ts.Type): ReplyVariant[] {
  if (type.isUnion?.()) {
    return (type as ts.UnionType).types.flatMap((t) => extractReplyVariants(tsi, checker, t));
  }

  const promised = (checker as ts.TypeChecker & { getPromisedTypeOfPromise?: (type: ts.Type) => ts.Type | undefined }).getPromisedTypeOfPromise?.(type);
  if (promised) return extractReplyVariants(tsi, checker, promised);

  if (!isReplyType(type)) return [];

  const ref = type as ts.TypeReference;
  const args = checker.getTypeArguments(ref);
  const body = args[0];
  const statusT = args[1];

  if (!statusT) return [];

  const statuses = literalNumbers(tsi, statusT);
  return statuses.map((s) => ({ status: s, body }));
}
