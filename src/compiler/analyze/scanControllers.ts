import ts from "typescript";
import { defaultOperationId } from "../../utils/operationId.js";

export interface ScannedController {
  className: string;
  basePath: string;
  sourceFile: ts.SourceFile;
  classDeclaration: ts.ClassDeclaration;
  operations: ScannedOperation[];
  consumes?: string[];
  produces?: string[];
}

export interface ScannedOperation {
  methodName: string;
  httpMethod: string;
  path: string;
  operationId: string;
  methodDeclaration: ts.MethodDeclaration;
  returnType: ts.Type;
  parameters: ScannedParameter[];
  pathParamIndices: number[];
  bodyParamIndex: number | null;
  queryParamIndices: number[];
  queryObjectParamIndex: number | null;
  headerObjectParamIndex: number | null;
  cookieObjectParamIndex: number | null;
  bodyContentType?: string;
}

export interface ScannedParameter {
  name: string;
  index: number;
  type: ts.Type;
  isOptional: boolean;
  paramNode?: ts.ParameterDeclaration;
}

export function scanControllers(
  sourceFiles: ts.SourceFile[],
  checker: ts.TypeChecker
): ScannedController[] {
  const controllers: ScannedController[] = [];

  for (const sourceFile of sourceFiles) {
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        const controller = analyzeClass(node, sourceFile, checker);
        if (controller) {
          controllers.push(controller);
        }
      }
    });
  }

  return controllers;
}

function analyzeClass(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): ScannedController | null {
  if (!node.name) return null;

  const controllerDecorator = findDecorator(node, "Controller");
  if (!controllerDecorator) return null;

  const basePath = extractDecoratorStringArg(controllerDecorator) ?? "/";
  const className = node.name.text;

  const consumes = extractClassConsumes(node, checker);
  const produces = extractClassProduces(node, checker);

  const operations: ScannedOperation[] = [];

  for (const member of node.members) {
    if (ts.isMethodDeclaration(member) && member.name) {
      const operation = analyzeMethod(member, className, checker);
      if (operation) {
        operations.push(operation);
      }
    }
  }

  if (operations.length === 0) return null;

  return {
    className,
    basePath,
    sourceFile,
    classDeclaration: node,
    operations,
    consumes,
    produces,
  };
}

function extractClassConsumes(node: ts.ClassDeclaration, checker: ts.TypeChecker): string[] | undefined {
  const decorator = findDecorator(node, "Consumes");
  if (!decorator) return undefined;

  const callExpr = decorator.expression;
  if (!ts.isCallExpression(callExpr)) return undefined;
  const args = callExpr.arguments;
  if (args.length === 0) return undefined;

  const firstArg = args[0];
  if (ts.isStringLiteral(firstArg)) {
    return [firstArg.text];
  }
  if (ts.isArrayLiteralExpression(firstArg)) {
    return firstArg.elements
      .filter(ts.isStringLiteral)
      .map(e => e.text);
  }
  return undefined;
}

function extractClassProduces(node: ts.ClassDeclaration, checker: ts.TypeChecker): string[] | undefined {
  const decorator = findDecorator(node, "Produces");
  if (!decorator) return undefined;

  const callExpr = decorator.expression;
  if (!ts.isCallExpression(callExpr)) return undefined;
  const args = callExpr.arguments;
  if (args.length === 0) return undefined;

  const firstArg = args[0];
  if (ts.isStringLiteral(firstArg)) {
    return [firstArg.text];
  }
  if (ts.isArrayLiteralExpression(firstArg)) {
    return firstArg.elements
      .filter(ts.isStringLiteral)
      .map(e => e.text);
  }
  return undefined;
}

function analyzeMethod(
  node: ts.MethodDeclaration,
  className: string,
  checker: ts.TypeChecker
): ScannedOperation | null {
  const methodName = ts.isIdentifier(node.name) ? node.name.text : null;
  if (!methodName) return null;

  const httpMethods = ["Get", "Post", "Put", "Patch", "Delete"];
  let httpMethod: string | null = null;
  let path = "/";

  for (const method of httpMethods) {
    const decorator = findDecorator(node, method);
    if (decorator) {
      httpMethod = method.toUpperCase();
      path = extractDecoratorStringArg(decorator) ?? "/";
      break;
    }
  }

  if (!httpMethod) return null;

  const signature = checker.getSignatureFromDeclaration(node);
  if (!signature) return null;

  let returnType = checker.getReturnTypeOfSignature(signature);
  returnType = unwrapPromise(returnType, checker);

  const parameters: ScannedParameter[] = [];
  for (let i = 0; i < node.parameters.length; i++) {
    const param = node.parameters[i];
    const paramName = ts.isIdentifier(param.name) ? param.name.text : `arg${i}`;
    const paramType = checker.getTypeAtLocation(param);
    const isOptional = !!param.questionToken || !!param.initializer;

    parameters.push({
      name: paramName,
      index: i,
      type: paramType,
      isOptional,
      paramNode: param,
    });
  }

  const pathParamNames = extractPathParams(path);
  const pathParamIndices = matchPathParamsToIndices(pathParamNames, parameters);
  
  const { bodyParamIndex, queryParamIndices, queryObjectParamIndex, headerObjectParamIndex, cookieObjectParamIndex, bodyContentType } = 
    classifyParameters(parameters, httpMethod, pathParamIndices, checker);

  return {
    methodName,
    httpMethod,
    path,
    operationId: defaultOperationId(className, methodName),
    methodDeclaration: node,
    returnType,
    parameters,
    pathParamIndices,
    bodyParamIndex,
    queryParamIndices,
    queryObjectParamIndex,
    headerObjectParamIndex,
    cookieObjectParamIndex,
    bodyContentType,
  };
}

function extractPathParams(path: string): string[] {
  const matches = path.match(/:([^/]+)/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1));
}

function matchPathParamsToIndices(pathParamNames: string[], parameters: ScannedParameter[]): number[] {
  const indices: number[] = [];
  for (const name of pathParamNames) {
    const param = parameters.find(p => p.name === name);
    if (param) {
      indices.push(param.index);
    }
  }
  return indices;
}

function classifyParameters(
  parameters: ScannedParameter[],
  httpMethod: string,
  pathParamIndices: number[],
  checker: ts.TypeChecker
): {
  bodyParamIndex: number | null;
  queryParamIndices: number[];
  queryObjectParamIndex: number | null;
  headerObjectParamIndex: number | null;
  cookieObjectParamIndex: number | null;
  bodyContentType: string | undefined;
} {
  const usedIndices = new Set(pathParamIndices);
  const queryParamIndices: number[] = [];
  let bodyParamIndex: number | null = null;
  let queryObjectParamIndex: number | null = null;
  let headerObjectParamIndex: number | null = null;
  let cookieObjectParamIndex: number | null = null;

  const isBodyMethod = ["POST", "PUT", "PATCH"].includes(httpMethod);

  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i];
    if (usedIndices.has(i)) continue;

    const typeStr = param.type.getSymbol()?.getName() ?? "";

    if (typeStr === "Body") {
      bodyParamIndex = i;
      usedIndices.add(i);
      continue;
    }

    if (typeStr === "Query") {
      queryObjectParamIndex = i;
      usedIndices.add(i);
      continue;
    }

    if (typeStr === "Headers") {
      headerObjectParamIndex = i;
      usedIndices.add(i);
      continue;
    }

    if (typeStr === "Cookies") {
      cookieObjectParamIndex = i;
      usedIndices.add(i);
      continue;
    }

    if (isBodyMethod && bodyParamIndex === null) {
      bodyParamIndex = i;
      usedIndices.add(i);
      continue;
    }

    const isObj = isObjectType(param.type, checker);
    if (isObj && queryObjectParamIndex === null && !isBodyMethod) {
      queryObjectParamIndex = i;
      usedIndices.add(i);
      continue;
    }

    queryParamIndices.push(i);
    usedIndices.add(i);
  }

  return {
    bodyParamIndex,
    queryParamIndices,
    queryObjectParamIndex,
    headerObjectParamIndex,
    cookieObjectParamIndex,
    bodyContentType: undefined,
  };
}

function isObjectType(type: ts.Type, checker: ts.TypeChecker): boolean {
  const objectFlags = (type.flags & ts.TypeFlags.Object) !== 0;
  if (!objectFlags) return false;

  const symbol = type.getSymbol();
  if (symbol?.getName() === "__object") return true;

  const properties = checker.getPropertiesOfType(type);
  if (properties.length > 0) return true;

  const callSignatures = type.getCallSignatures();
  if (callSignatures && callSignatures.length > 0) return false;

  return true;
}

function findDecorator(node: ts.HasDecorators, name: string): ts.Decorator | null {
  const decorators = ts.getDecorators(node);
  if (!decorators) return null;

  for (const decorator of decorators) {
    if (ts.isCallExpression(decorator.expression)) {
      const expr = decorator.expression.expression;
      if (ts.isIdentifier(expr) && expr.text === name) {
        return decorator;
      }
    }
  }
  return null;
}

function extractDecoratorStringArg(decorator: ts.Decorator): string | null {
  if (ts.isCallExpression(decorator.expression)) {
    const arg = decorator.expression.arguments[0];
    if (arg && ts.isStringLiteral(arg)) {
      return arg.text;
    }
  }
  return null;
}

function unwrapPromise(type: ts.Type, checker: ts.TypeChecker): ts.Type {
  const symbol = type.getSymbol();
  if (symbol?.getName() === "Promise") {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    if (typeArgs && typeArgs.length > 0) {
      return typeArgs[0];
    }
  }
  return type;
}
