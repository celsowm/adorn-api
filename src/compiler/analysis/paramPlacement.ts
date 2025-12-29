import type * as ts from 'typescript';
import type { ArgBinding, ScalarHint } from '../../contracts/route-options.js';
import { extractPathTokens } from './pathTokens.js';
import { scalarHintFromType } from './signature.js';

type ParamRole = 'path' | 'queryObject' | 'queryScalar' | 'body' | 'ctx' | 'unknown';

function paramName(tsi: typeof ts, p: ts.ParameterDeclaration): string | undefined {
  return tsi.isIdentifier(p.name) ? p.name.text : undefined;
}

function hasJSDocTag(tsi: typeof ts, p: ts.ParameterDeclaration, tag: string): boolean {
  const tags = tsi.getJSDocTags(p);
  return tags.some((t) => t.tagName.getText() === tag);
}

function isScalar(tsi: typeof ts, t: ts.Type): boolean {
  return !!(
    (t.flags & tsi.TypeFlags.StringLike) ||
    (t.flags & tsi.TypeFlags.NumberLike) ||
    (t.flags & tsi.TypeFlags.BooleanLike)
  );
}

function isContextType(tsi: typeof ts, checker: ts.TypeChecker, t: ts.Type): boolean {
  const s = checker.typeToString(t);
  return s.includes('RequestContext') || s.endsWith('.RequestContext');
}

function isObjectLike(tsi: typeof ts, checker: ts.TypeChecker, t: ts.Type): boolean {
  if (checker.isArrayType(t)) return false;
  if (isScalar(tsi, t)) return false;
  return (t.flags & tsi.TypeFlags.Object) !== 0;
}

export type PlacementResult = {
  args: ArgBinding[];
  pathMap: Record<string, ScalarHint | undefined>;
  queryParamSchemaShape: Array<{ name: string; type: ts.Type; hint?: ScalarHint; optional: boolean }> | undefined;
  queryObjectType: ts.Type | undefined;
  bodyType: ts.Type | undefined;
  paramsShape: Array<{ name: string; type: ts.Type; hint?: ScalarHint }> | undefined;
};

export function inferPlacement(
  tsi: typeof ts,
  checker: ts.TypeChecker,
  methodDecl: ts.MethodDeclaration,
  httpMethod: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE',
  routePath: string,
): PlacementResult {
  const tokens = extractPathTokens(routePath);
  const params = methodDecl.parameters;

  const assigned = new Set<number>();
  const args: ArgBinding[] = [];

  const tokenToIndex = new Map<string, number>();
  for (const tok of tokens) {
    const idxByName = params.findIndex((p, i) => !assigned.has(i) && paramName(tsi, p) === tok);
    const idx = idxByName >= 0 ? idxByName : params.findIndex((_, i) => !assigned.has(i));
    if (idx >= 0) {
      assigned.add(idx);
      tokenToIndex.set(tok, idx);
    }
  }

  const roles: ParamRole[] = params.map(() => 'unknown');
  for (const [, idx] of Array.from(tokenToIndex.entries())) roles[idx] = 'path';

  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (hasJSDocTag(tsi, p, 'ctx')) roles[i] = 'ctx';
    if (hasJSDocTag(tsi, p, 'body')) roles[i] = 'body';
    if (hasJSDocTag(tsi, p, 'query')) roles[i] = 'queryObject';
  }

  for (let i = params.length - 1; i >= 0; i--) {
    if (roles[i] !== 'unknown') continue;
    const t = checker.getTypeAtLocation(params[i]);
    if (isContextType(tsi, checker, t)) roles[i] = 'ctx';
  }

  if (httpMethod === 'POST' || httpMethod === 'PUT' || httpMethod === 'PATCH') {
    for (let i = 0; i < params.length; i++) {
      if (roles[i] !== 'unknown') continue;
      const t = checker.getTypeAtLocation(params[i]);
      if (isObjectLike(tsi, checker, t)) {
        roles[i] = 'body';
        break;
      }
    }
  }

  for (let i = 0; i < params.length; i++) {
    if (roles[i] !== 'unknown') continue;
    const t = checker.getTypeAtLocation(params[i]);
    if (isObjectLike(tsi, checker, t)) roles[i] = 'queryObject';
    else roles[i] = 'queryScalar';
  }

  const pathMap: Record<string, ScalarHint | undefined> = {};
  const queryParamSchemaShape: Array<{ name: string; type: ts.Type; hint?: ScalarHint; optional: boolean }> = [];
  let queryObjectType: ts.Type | undefined;
  let bodyType: ts.Type | undefined;
  const paramsShape: Array<{ name: string; type: ts.Type; hint?: ScalarHint }> = [];

  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    const t = checker.getTypeAtLocation(p);
    const name = paramName(tsi, p) ?? `arg${i}`;

    if (roles[i] === 'path') {
      const tok = tokens.find((tk) => tokenToIndex.get(tk) === i) ?? name;
      const hint = scalarHintFromType(tsi, t, 'path');
      args.push({ kind: 'path', name: tok, ...(hint ? { type: hint } : {}) });
      pathMap[tok] = hint;
      if (hint) paramsShape.push({ name: tok, type: t, hint });
      continue;
    }

    if (roles[i] === 'ctx') {
      args.push({ kind: 'ctx' });
      continue;
    }

    if (roles[i] === 'body') {
      args.push({ kind: 'body' });
      bodyType = t;
      continue;
    }

    if (roles[i] === 'queryObject') {
      args.push({ kind: 'query' });
      queryObjectType = t;
      continue;
    }

    if (roles[i] === 'queryScalar') {
      const hint = scalarHintFromType(tsi, t, 'query');
      args.push({ kind: 'query', name, ...(hint ? { type: hint } : {}) });
      if (hint) queryParamSchemaShape.push({ name, type: t, hint, optional: !!p.questionToken || !!p.initializer });
      continue;
    }

    args.push({ kind: 'query', name });
  }

  return {
    args,
    pathMap,
    queryParamSchemaShape: queryParamSchemaShape.length ? queryParamSchemaShape : undefined,
    queryObjectType,
    bodyType,
    paramsShape: paramsShape.length ? paramsShape : undefined,
  };
}
