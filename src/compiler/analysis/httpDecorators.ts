import type * as ts from 'typescript';
import type { HttpDecoratorName, HttpMethod } from '../contracts.js';

const HTTP_DECORATORS: Record<HttpDecoratorName, HttpMethod> = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
};

export function isHttpDecoratorName(name: string): name is HttpDecoratorName {
  return (name as HttpDecoratorName) in HTTP_DECORATORS;
}

export function httpMethodFromDecorator(name: HttpDecoratorName): HttpMethod {
  return HTTP_DECORATORS[name];
}

function calleeName(tsi: typeof ts, call: ts.CallExpression): string | undefined {
  const callee = call.expression;
  if (tsi.isIdentifier(callee)) return callee.text;
  if (tsi.isPropertyAccessExpression(callee)) return callee.name.text;
  return undefined;
}

export function readHttpDecoratorCall(
  tsi: typeof ts,
  decorator: ts.Decorator,
): ts.CallExpression | undefined {
  const expr = decorator.expression;
  if (!tsi.isCallExpression(expr)) return undefined;
  const name = calleeName(tsi, expr);
  if (!name || !isHttpDecoratorName(name)) return undefined;
  return expr;
}

export function isFromPackage(
  tsi: typeof ts,
  checker: ts.TypeChecker,
  call: ts.CallExpression,
  packageName: string,
): boolean {
  const callee = call.expression;
  const sym =
    checker.getSymbolAtLocation(
      tsi.isPropertyAccessExpression(callee) ? callee.name : callee,
    ) ?? checker.getSymbolAtLocation(callee);

  if (!sym) return false;

  const decls = sym.getDeclarations() ?? [];
  for (const d of decls) {
    const sf = d.getSourceFile();
    const fn = sf?.fileName ?? '';
    if (fn.includes(`node_modules/${packageName}/`) || fn.includes(`node_modules\\${packageName}\\`)) {
      return true;
    }
  }
  return false;
}
