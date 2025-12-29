import type * as ts from 'typescript';
import type { ScalarHint, ParamModel, ReturnModel } from '../contracts.js';

export function unwrapPromise(tsi: typeof ts, checker: ts.TypeChecker, type: ts.Type): {
  unwrapped: ts.Type;
  isPromise: boolean;
} {
  const promised =
    (checker as ts.TypeChecker & { getPromisedTypeOfPromise?: (type: ts.Type) => ts.Type | undefined }).getPromisedTypeOfPromise?.(type) as ts.Type | undefined;

  if (promised) return { unwrapped: promised, isPromise: true };
  return { unwrapped: type, isPromise: false };
}

export function paramModels(
  tsi: typeof ts,
  checker: ts.TypeChecker,
  methodDecl: ts.MethodDeclaration,
): ParamModel[] {
  return methodDecl.parameters.map((p) => {
    const name = tsi.isIdentifier(p.name) ? p.name.text : p.name.getText();
    const t = checker.getTypeAtLocation(p);
    return {
      name,
      typeText: checker.typeToString(t, p, tsi.TypeFormatFlags.NoTruncation),
      isOptional: !!p.questionToken || !!p.initializer,
    };
  });
}

export function returnModel(
  tsi: typeof ts,
  checker: ts.TypeChecker,
  methodDecl: ts.MethodDeclaration,
): ReturnModel {
  const sig = checker.getSignatureFromDeclaration(methodDecl);
  const t = sig ? checker.getReturnTypeOfSignature(sig) : checker.getTypeAtLocation(methodDecl);
  const { unwrapped, isPromise } = unwrapPromise(tsi, checker, t);

  return {
    typeText: checker.typeToString(t, methodDecl, tsi.TypeFormatFlags.NoTruncation),
    unwrappedTypeText: checker.typeToString(unwrapped, methodDecl, tsi.TypeFormatFlags.NoTruncation),
    isPromise,
  };
}

export function scalarHintFromType(
  tsi: typeof ts,
  type: ts.Type,
  purpose: 'path' | 'query',
): ScalarHint | undefined {
  if (type.flags & tsi.TypeFlags.BooleanLike) return 'boolean';

  if (type.flags & tsi.TypeFlags.StringLike) return 'string';

  if (type.flags & tsi.TypeFlags.NumberLike) {
    return purpose === 'path' ? 'int' : 'number';
  }

  const sym = type.getSymbol?.();
  const n = sym?.getName?.() ?? '';
  if (n === 'UUID' || n === 'Uuid') return 'uuid';

  return undefined;
}
