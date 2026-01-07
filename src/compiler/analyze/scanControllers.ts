/**
 * Scans TypeScript source files for controller classes decorated with @Controller and extracts their operations.
 * This module provides the foundation for API compilation by identifying all HTTP endpoints defined in the codebase.
 */
import ts from "typescript";
import { defaultOperationId } from "../../utils/operationId.js";

/**
 * Represents a scanned controller class with its metadata and operations.
 * Contains information about the controller class, base path, and all HTTP operations it defines.
 */
export interface ScannedController {
  /** The name of the controller class */
  className: string;
  /** The base path prefix for all operations in this controller */
  basePath: string;
  /** The TypeScript source file containing this controller */
  sourceFile: ts.SourceFile;
  /** The class declaration node from the TypeScript AST */
  classDeclaration: ts.ClassDeclaration;
  /** Array of scanned operations (endpoints) in this controller */
  operations: ScannedOperation[];
  /** Optional list of content types this controller consumes */
  consumes?: string[];
  /** Optional list of content types this controller produces */
  produces?: string[];
}

/**
 * Represents a scanned HTTP operation (endpoint) within a controller.
 * Contains all metadata needed to generate API documentation and client code.
 */
export interface ScannedOperation {
  /** The name of the method implementing this operation */
  methodName: string;
  /** The HTTP method (GET, POST, PUT, PATCH, DELETE) */
  httpMethod: string;
  /** The URL path for this operation, relative to controller base path */
  path: string;
  /** Unique identifier for this operation, used in OpenAPI specs and client generation */
  operationId: string;
  /** The method declaration node from the TypeScript AST */
  methodDeclaration: ts.MethodDeclaration;
  /** The TypeScript return type of this operation */
  returnType: ts.Type;
  /** Optional TypeScript type node for the return type */
  returnTypeNode?: ts.TypeNode;
  /** Array of scanned parameters for this operation */
  parameters: ScannedParameter[];
  /** Indices of parameters that are path parameters */
  pathParamIndices: number[];
  /** Index of the parameter that is the request body, or null if none */
  bodyParamIndex: number | null;
  /** Indices of parameters that are query parameters */
  queryParamIndices: number[];
  /** Index of the parameter that is a query object (all query params as properties), or null if none */
  queryObjectParamIndex: number | null;
  /** Index of the parameter that is a headers object, or null if none */
  headerObjectParamIndex: number | null;
  /** Index of the parameter that is a cookies object, or null if none */
  cookieObjectParamIndex: number | null;
  /** The content type of the request body, if applicable */
  bodyContentType?: string;
}

/**
 * Represents a scanned parameter of an operation.
 * Contains metadata about the parameter's name, type, and position.
 */
export interface ScannedParameter {
  /** The name of the parameter */
  name: string;
  /** The zero-based index of the parameter in the function signature */
  index: number;
  /** The TypeScript type of this parameter */
  type: ts.Type;
  /** Whether this parameter is optional */
  isOptional: boolean;
  /** Optional parameter declaration node from the TypeScript AST */
  paramNode?: ts.ParameterDeclaration;
}

/**
 * Scans an array of TypeScript source files for controller classes and extracts their operations.
 * Only classes decorated with @Controller are considered, and only methods with HTTP method decorators
 * (e.g., @Get, @Post) are treated as operations.
 * 
 * @param sourceFiles - Array of TypeScript source files to scan
 * @param checker - TypeScript type checker for analyzing types
 * @returns Array of scanned controllers with their operations
 */
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

/**
 * Analyzes a TypeScript class declaration to determine if it's a controller and extracts its metadata.
 * 
 * @param node - The class declaration node to analyze
 * @param sourceFile - The source file containing the class
 * @param checker - TypeScript type checker for analyzing types
 * @returns ScannedController if the class is a valid controller, null otherwise
 */
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

/**
 * Extracts the @Consumes decorator content types from a controller class.
 * @internal
 */
function extractClassConsumes(node: ts.ClassDeclaration, _checker: ts.TypeChecker): string[] | undefined {
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

/**
 * Extracts the @Produces decorator content types from a controller class.
 * @internal
 */
function extractClassProduces(node: ts.ClassDeclaration, _checker: ts.TypeChecker): string[] | undefined {
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

/**
 * Analyzes a method declaration to determine if it's an HTTP operation and extracts its metadata.
 * @internal
 */
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
  const returnTypeNode = unwrapPromiseTypeNode(node.type);

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
    returnTypeNode,
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

/**
 * Extracts path parameter names from a URL path string.
 * Path parameters are denoted by colon prefixes (e.g., ":id", ":userId").
 * @internal
 */
function extractPathParams(path: string): string[] {
  const matches = path.match(/:([^/]+)/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1));
}

/**
 * Maps path parameter names to their indices in the parameters array.
 * @internal
 */
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

/**
 * Classifies parameters into different categories (body, query, path, headers, cookies).
 * This determines how each parameter will be processed in the OpenAPI generation.
 * @internal
 */
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

    const nonNullableType = checker.getNonNullableType(param.type);
    const typeStr = getTypeName(param.type) || getTypeName(nonNullableType);

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

    const isObj = isObjectType(nonNullableType, checker);
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

/**
 * Checks if a TypeScript type represents an object type.
 * @internal
 */
function isObjectType(type: ts.Type, checker: ts.TypeChecker): boolean {
  const objectFlags = (type.flags & ts.TypeFlags.Object) !== 0;
  const intersectionFlags = (type.flags & ts.TypeFlags.Intersection) !== 0;
  
  if (!objectFlags && !intersectionFlags) return false;

  const symbol = type.getSymbol();
  if (symbol?.getName() === "__object") return true;

  const properties = checker.getPropertiesOfType(type);
  if (properties.length > 0) return true;

  const callSigs = type.getCallSignatures?.();
  if (callSigs && callSigs.length > 0) return false;

  return true;
}

/**
 * Gets the type name from a TypeScript type, checking both alias and direct symbols.
 * @internal
 */
function getTypeName(type: ts.Type): string {
  const aliasSymbol = (type as ts.TypeReference).aliasSymbol ?? (type as any).aliasSymbol;
  if (aliasSymbol) return aliasSymbol.getName();
  const symbol = type.getSymbol();
  return symbol?.getName() ?? "";
}

/**
 * Finds a decorator by name on a TypeScript node.
 * @internal
 */
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

/**
 * Extracts the first string argument from a decorator call expression.
 * @internal
 */
function extractDecoratorStringArg(decorator: ts.Decorator): string | null {
  if (ts.isCallExpression(decorator.expression)) {
    const arg = decorator.expression.arguments[0];
    if (arg && ts.isStringLiteral(arg)) {
      return arg.text;
    }
  }
  return null;
}

/**
 * Unwraps a Promise type to get the inner type.
 * @internal
 */
function unwrapPromise(type: ts.Type, _checker: ts.TypeChecker): ts.Type {
  const symbol = type.getSymbol();
  if (symbol?.getName() === "Promise") {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    if (typeArgs && typeArgs.length > 0) {
      return typeArgs[0];
    }
  }
  return type;
}

/**
 * Unwraps a Promise type node to get the inner type node.
 * @internal
 */
function unwrapPromiseTypeNode(typeNode?: ts.TypeNode): ts.TypeNode | undefined {
  if (!typeNode) return undefined;

  if (ts.isTypeReferenceNode(typeNode)) {
    if (ts.isIdentifier(typeNode.typeName) && typeNode.typeName.text === "Promise") {
      return typeNode.typeArguments?.[0] ?? typeNode;
    }
  }

  return typeNode;
}
