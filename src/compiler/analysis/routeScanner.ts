import type * as ts from 'typescript';
import type { PluginConfig, RouteMatch, HttpDecoratorName } from '../contracts.js';
import { readHttpDecoratorCall, isFromPackage } from './httpDecorators.js';

function readPathArg(tsi: typeof ts, call: ts.CallExpression): string | undefined {
  const a0 = call.arguments[0];
  if (!a0) return undefined;
  if (tsi.isStringLiteral(a0) || tsi.isNoSubstitutionTemplateLiteral(a0)) return a0.text;
  return undefined;
}

export function scanSourceFile(
  tsi: typeof ts,
  checker: ts.TypeChecker,
  sf: ts.SourceFile,
  cfg: Required<Pick<PluginConfig, 'packageName'>>,
): RouteMatch[] {
  const out: RouteMatch[] = [];

  function visit(node: ts.Node) {
    if (tsi.isClassDeclaration(node) && node.name) {
      const className = node.name.text;

      for (const member of node.members) {
        if (!tsi.isMethodDeclaration(member) || !member.name) continue;

        const decorators = tsi.canHaveDecorators(member) ? (tsi.getDecorators(member) ?? []) : [];
        if (!decorators.length) continue;

        for (const d of decorators) {
          const call = readHttpDecoratorCall(tsi, d);
          if (!call) continue;

          if (!isFromPackage(tsi, checker, call, cfg.packageName)) continue;

          const path = readPathArg(tsi, call);
          if (!path) continue;

          const callee = call.expression;
          const decoratorName =
            tsi.isIdentifier(callee) ? callee.text :
            tsi.isPropertyAccessExpression(callee) ? callee.name.text :
            undefined;

          if (!decoratorName) continue;

          const methodName = tsi.isIdentifier(member.name) ? member.name.text : member.name.getText();

          out.push({
            sourceFile: sf,
            className,
            methodDecl: member,
            methodName,
            decoratorName: decoratorName as HttpDecoratorName,
            decoratorCall: call,
            path,
          });
        }
      }
    }

    tsi.forEachChild(node, visit);
  }

  visit(sf);
  return out;
}
