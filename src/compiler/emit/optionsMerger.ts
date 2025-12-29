import type * as ts from 'typescript';

function getPropName(tsi: typeof ts, n: ts.PropertyName): string | undefined {
  if (tsi.isIdentifier(n)) return n.text;
  if (tsi.isStringLiteral(n)) return n.text;
  return undefined;
}

function findProp(tsi: typeof ts, obj: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined {
  for (const p of obj.properties) {
    if (!tsi.isPropertyAssignment(p)) continue;
    const pn = getPropName(tsi, p.name);
    if (pn === name) return p;
  }
  return undefined;
}

function mergeObjectLiterals(
  tsi: typeof ts,
  base: ts.ObjectLiteralExpression,
  add: ts.ObjectLiteralExpression,
): ts.ObjectLiteralExpression {
  const outProps: ts.ObjectLiteralElementLike[] = [...base.properties];

  for (const ap of add.properties) {
    if (!tsi.isPropertyAssignment(ap)) continue;
    const apn = getPropName(tsi, ap.name);
    if (!apn) continue;

    const existing = findProp(tsi, base, apn);
    if (!existing) {
      outProps.push(ap);
      continue;
    }

    if (tsi.isObjectLiteralExpression(existing.initializer) && tsi.isObjectLiteralExpression(ap.initializer)) {
      const merged = mergeObjectLiterals(tsi, existing.initializer, ap.initializer);
      const replaced = tsi.factory.updatePropertyAssignment(existing, existing.name, merged);
      const idx = outProps.indexOf(existing);
      outProps[idx] = replaced;
    }
  }

  return tsi.factory.createObjectLiteralExpression(outProps, true);
}

export type PatchPieces = {
  validate?: ts.ObjectLiteralExpression;
  bindings?: ts.ObjectLiteralExpression;
  responses?: ts.ObjectLiteralExpression;
  successStatus?: ts.Expression;
};

export function patchRouteOptions(
  tsi: typeof ts,
  existing: ts.Expression | undefined,
  pieces: PatchPieces,
): ts.Expression | undefined {
  const additions: ts.ObjectLiteralElementLike[] = [];

  if (pieces.validate) additions.push(tsi.factory.createPropertyAssignment('validate', pieces.validate));
  if (pieces.bindings) additions.push(tsi.factory.createPropertyAssignment('bindings', pieces.bindings));
  if (pieces.responses) additions.push(tsi.factory.createPropertyAssignment('responses', pieces.responses));
  if (pieces.successStatus) additions.push(tsi.factory.createPropertyAssignment('successStatus', pieces.successStatus));

  if (additions.length === 0) return existing;

  const addObj = tsi.factory.createObjectLiteralExpression(additions, true);

  if (!existing) return addObj;

  if (!tsi.isObjectLiteralExpression(existing)) {
    return existing;
  }

  return mergeObjectLiterals(tsi, existing, addObj);
}
