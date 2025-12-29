import type * as ts from 'typescript';
import type { PluginConfig } from '../contracts.js';
import { extractPathTokens } from '../analysis/pathTokens.js';
import { readHttpDecoratorCall, isFromPackage, isHttpDecoratorName, httpMethodFromDecorator } from '../analysis/httpDecorators.js';
import { unwrapPromise, scalarHintFromType } from '../analysis/signature.js';
import { SchemaHoister } from '../emit/schemaHoister.js';
import { ensureImportedV } from '../emit/importPatcher.js';
import { patchRouteOptions } from '../emit/optionsMerger.js';

type TransformerExtras = {
  ts: typeof ts;
  addDiagnostic?: (d: ts.Diagnostic) => void;
};

function defaultSuccessStatus(method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'): number {
  if (method === 'POST') return 201;
  return 200;
}

function isVoidish(tsi: typeof ts, t: ts.Type): boolean {
  return (t.flags & tsi.TypeFlags.Void) !== 0 || (t.flags & tsi.TypeFlags.Undefined) !== 0;
}

export default function transform(
  program: ts.Program,
  pluginConfig: PluginConfig,
  extras: TransformerExtras,
): ts.TransformerFactory<ts.SourceFile> {
  const tsi = extras.ts;
  const checker = program.getTypeChecker();

  const packageName = pluginConfig.packageName ?? 'adorn-api';
  const strictObjects = pluginConfig.strictObjects ?? true;

  return (ctx) => {
    return (sf0) => {
      let sf = ensureImportedV(tsi, sf0, packageName);

      const hoister = new SchemaHoister(tsi, checker, strictObjects, tsi.factory.createIdentifier('v'));
      let touched = false;

      const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
        if (!tsi.isMethodDeclaration(node)) return tsi.visitEachChild(node, visitor, ctx);

        const decorators = tsi.canHaveDecorators(node) ? (tsi.getDecorators(node) ?? []) : [];
        if (!decorators.length) return tsi.visitEachChild(node, visitor, ctx);

        let newDecorators: ts.Decorator[] | undefined;

        for (let i = 0; i < decorators.length; i++) {
          const d = decorators[i];
          const call = readHttpDecoratorCall(tsi, d);
          if (!call) continue;

          if (!isFromPackage(tsi, checker, call, packageName)) continue;

          const callee = call.expression;
          const decoratorName =
            tsi.isIdentifier(callee) ? callee.text :
            tsi.isPropertyAccessExpression(callee) ? callee.name.text :
            undefined;

          if (!decoratorName || !isHttpDecoratorName(decoratorName)) continue;

          const a0 = call.arguments[0];
          if (!a0 || !(tsi.isStringLiteral(a0) || tsi.isNoSubstitutionTemplateLiteral(a0))) continue;
          const path = a0.text;

          const httpMethod = httpMethodFromDecorator(decoratorName);
          const tokens = extractPathTokens(path);

          const pathHints: Record<string, string> = {};
          for (let pi = 0; pi < tokens.length; pi++) {
            const p = node.parameters[pi];
            if (!p) continue;
            const t = checker.getTypeAtLocation(p);
            const hint = scalarHintFromType(tsi, t, 'path');
            if (hint) pathHints[tokens[pi]] = hint;
          }

          const bindingsObj =
            Object.keys(pathHints).length === 0
              ? undefined
              : tsi.factory.createObjectLiteralExpression(
                  [
                    tsi.factory.createPropertyAssignment(
                      'path',
                      tsi.factory.createObjectLiteralExpression(
                        Object.entries(pathHints).map(([k, v]) =>
                          tsi.factory.createPropertyAssignment(
                            tsi.factory.createStringLiteral(k),
                            tsi.factory.createStringLiteral(v),
                          ),
                        ),
                        true,
                      ),
                    ),
                  ],
                  true,
                );

          let validateParamsSchemaExpr: ts.Expression | undefined;
          if (tokens.length) {
            const shapeProps: ts.PropertyAssignment[] = [];

            for (let pi = 0; pi < tokens.length; pi++) {
              const tok = tokens[pi];
              const p = node.parameters[pi];
              if (!p) continue;
              const pt = checker.getTypeAtLocation(p);

              let sch = hoister.getOrCreate(pt, `Param_${tok}`);
              if (!sch) {
                const hint = pathHints[tok];
                if (hint === 'int') {
                  sch = tsi.factory.createCallExpression(
                    tsi.factory.createPropertyAccessExpression(
                      tsi.factory.createCallExpression(
                        tsi.factory.createPropertyAccessExpression(tsi.factory.createIdentifier('v'), 'number'),
                        undefined,
                        [],
                      ),
                      'int',
                    ),
                    undefined,
                    [],
                  );
                } else if (hint === 'number') {
                  sch = tsi.factory.createCallExpression(
                    tsi.factory.createPropertyAccessExpression(tsi.factory.createIdentifier('v'), 'number'),
                    undefined,
                    [],
                  );
                } else if (hint === 'boolean') {
                  sch = tsi.factory.createCallExpression(
                    tsi.factory.createPropertyAccessExpression(tsi.factory.createIdentifier('v'), 'boolean'),
                    undefined,
                    [],
                  );
                } else {
                  sch = tsi.factory.createCallExpression(
                    tsi.factory.createPropertyAccessExpression(tsi.factory.createIdentifier('v'), 'string'),
                    undefined,
                    [],
                  );
                }
              }

              shapeProps.push(
                tsi.factory.createPropertyAssignment(tsi.factory.createIdentifier(tok), sch),
              );
            }

            const paramsSchema = tsi.factory.createCallExpression(
              tsi.factory.createPropertyAccessExpression(tsi.factory.createIdentifier('v'), 'object'),
              undefined,
              [tsi.factory.createObjectLiteralExpression(shapeProps, true)],
            );

            const strictParamsSchema = strictObjects
              ? tsi.factory.createCallExpression(tsi.factory.createPropertyAccessExpression(paramsSchema, 'strict'), undefined, [])
              : paramsSchema;

            validateParamsSchemaExpr = hoister.getOrCreate(
              checker.getTypeAtLocation(node),
              `${String(node.name?.getText() ?? 'method')}_Params`,
            ) ?? strictParamsSchema;
            validateParamsSchemaExpr = validateParamsSchemaExpr ?? strictParamsSchema;
          }

          let validateBodySchemaExpr: ts.Expression | undefined;
          const isWrite = httpMethod === 'POST' || httpMethod === 'PUT' || httpMethod === 'PATCH';

          if (isWrite) {
            const bodyParam = node.parameters[tokens.length];
            if (bodyParam) {
              const bt = checker.getTypeAtLocation(bodyParam);
              const bodyName = tsi.isIdentifier(bodyParam.name) ? bodyParam.name.text : 'Body';
              validateBodySchemaExpr = hoister.getOrCreate(bt, bodyName) ?? undefined;
            }
          }

          const sig = checker.getSignatureFromDeclaration(node);
          const retType = sig ? checker.getReturnTypeOfSignature(sig) : checker.getTypeAtLocation(node);
          const { unwrapped } = unwrapPromise(tsi, checker, retType);

          let responsesObj: ts.ObjectLiteralExpression | undefined;
          let successStatusExpr: ts.Expression | undefined;

          if (!isVoidish(tsi, unwrapped)) {
            const status = defaultSuccessStatus(httpMethod);
            const retSchema = hoister.getOrCreate(unwrapped, `${String(node.name?.getText() ?? 'method')}_Return`);
            if (retSchema) {
              responsesObj = tsi.factory.createObjectLiteralExpression(
                [
                  tsi.factory.createPropertyAssignment(
                    tsi.factory.createStringLiteral(String(status)),
                    retSchema,
                  ),
                ],
                true,
              );
            }
          } else if (httpMethod === 'DELETE') {
            successStatusExpr = tsi.factory.createNumericLiteral(204);
          }

          const validateProps: ts.PropertyAssignment[] = [];
          if (validateParamsSchemaExpr) validateProps.push(tsi.factory.createPropertyAssignment('params', validateParamsSchemaExpr));
          if (validateBodySchemaExpr) validateProps.push(tsi.factory.createPropertyAssignment('body', validateBodySchemaExpr));
          const validateObj = validateProps.length ? tsi.factory.createObjectLiteralExpression(validateProps, true) : undefined;

          const existingOptions = call.arguments[1];
          const patchedOptions = patchRouteOptions(tsi, existingOptions, {
            ...(validateObj ? { validate: validateObj } : {}),
            ...(bindingsObj ? { bindings: bindingsObj } : {}),
            ...(responsesObj ? { responses: responsesObj } : {}),
            ...(successStatusExpr ? { successStatus: successStatusExpr } : {}),
          });

          if (patchedOptions === existingOptions) continue;

          const newArgs = [call.arguments[0]];
          if (patchedOptions) newArgs.push(patchedOptions);

          const newCall = tsi.factory.updateCallExpression(call, call.expression, call.typeArguments, newArgs);
          const newDec = tsi.factory.updateDecorator(d, newCall);

          if (!newDecorators) newDecorators = [...decorators];
          newDecorators[i] = newDec;
          touched = true;
        }

        if (newDecorators) {
          const visited = tsi.visitEachChild(node, visitor, ctx) as ts.MethodDeclaration;
          return tsi.factory.updateMethodDeclaration(
            visited,
            visited.modifiers,
            visited.asteriskToken,
            visited.name,
            visited.questionToken,
            visited.typeParameters,
            visited.parameters,
            visited.type,
            visited.body,
          );
        }

        return tsi.visitEachChild(node, visitor, ctx);
      };

      const sfVisited = tsi.visitNode(sf, visitor) as ts.SourceFile;

      if (!touched) return sfVisited;

      const decls = hoister.getDeclarations();
      if (!decls.length) return sfVisited;

      const stmts = [...sfVisited.statements];
      let insertAt = 0;
      while (insertAt < stmts.length && tsi.isImportDeclaration(stmts[insertAt])) insertAt++;

      stmts.splice(insertAt, 0, ...decls);
      return tsi.factory.updateSourceFile(sfVisited, stmts);
    };
  };
}
