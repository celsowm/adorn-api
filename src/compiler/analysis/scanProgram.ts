import type * as ts from 'typescript';
import type { PluginConfig, RouteModel, RouteMatch, ScalarHint } from '../contracts.js';
import { scanSourceFile } from './routeScanner.js';
import { extractPathTokens } from './pathTokens.js';
import { httpMethodFromDecorator } from './httpDecorators.js';
import { paramModels, returnModel, scalarHintFromType } from './signature.js';

function shouldScanFile(fileName: string, includeNodeModules: boolean): boolean {
  if (fileName.endsWith('.d.ts')) return false;
  if (!includeNodeModules) {
    if (fileName.includes('/node_modules/') || fileName.includes('\\node_modules\\')) return false;
  }
  if (fileName.includes('/dist/') || fileName.includes('\\dist\\')) return false;
  return true;
}

function buildRouteModel(
  tsi: typeof ts,
  checker: ts.TypeChecker,
  m: RouteMatch,
): RouteModel {
  const params = paramModels(tsi, checker, m.methodDecl);
  const returns = returnModel(tsi, checker, m.methodDecl);

  const httpDecorator = m.decoratorName;
  const httpMethod = httpMethodFromDecorator(httpDecorator);

  const pathTokens = extractPathTokens(m.path);

  const pathHints: Record<string, ScalarHint | undefined> = {};
  for (let i = 0; i < pathTokens.length; i++) {
    const token = pathTokens[i];
    const p = m.methodDecl.parameters[i];
    if (!p) continue;
    const t = checker.getTypeAtLocation(p);
    pathHints[token] = scalarHintFromType(tsi, t, 'path');
  }

  return {
    fileName: m.sourceFile.fileName,
    className: m.className,
    methodName: m.methodName,
    httpDecorator,
    httpMethod,
    path: m.path,
    pathTokens,
    pathHints,
    params,
    returns,
  };
}

export function scanProgram(
  tsi: typeof ts,
  program: ts.Program,
  cfg: PluginConfig,
): RouteModel[] {
  const checker = program.getTypeChecker();
  const packageName = cfg.packageName ?? 'adorn-api';
  const includeNodeModules = cfg.includeNodeModules ?? false;

  const routes: RouteModel[] = [];

  for (const sf of program.getSourceFiles()) {
    if (!shouldScanFile(sf.fileName, includeNodeModules)) continue;

    const matches = scanSourceFile(tsi, checker, sf, { packageName });
    for (const m of matches) {
      routes.push(buildRouteModel(tsi, checker, m));
    }
  }

  return routes;
}
