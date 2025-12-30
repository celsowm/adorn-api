import ts from "typescript";
import { defaultOperationId } from "../../utils/operationId.js";

export interface ScannedController {
  className: string;
  basePath: string;
  sourceFile: ts.SourceFile;
  classDeclaration: ts.ClassDeclaration;
  operations: ScannedOperation[];
}

export interface ScannedOperation {
  methodName: string;
  httpMethod: string;
  path: string;
  operationId: string;
  methodDeclaration: ts.MethodDeclaration;
  returnType: ts.Type;
  parameters: ScannedParameter[];
}

export interface ScannedParameter {
  name: string;
  index: number;
  type: ts.Type;
  isOptional: boolean;
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
  };
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
    });
  }

  return {
    methodName,
    httpMethod,
    path,
    operationId: defaultOperationId(className, methodName),
    methodDeclaration: node,
    returnType,
    parameters,
  };
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
