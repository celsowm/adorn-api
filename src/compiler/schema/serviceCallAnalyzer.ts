/**
 * Service Call Analyzer
 * Traverses method call chains from controllers to services to detect query builder patterns
 */

import ts from "typescript";
import { analyzeQueryBuilderForSchema } from "./queryBuilderAnalyzer.js";
import type { QueryBuilderSchema } from "./queryBuilderAnalyzer.js";

export interface ServiceCallInfo {
  /** Service class name */
  serviceName: string;
  /** Method name being called */
  methodName: string;
  /** File path containing the service */
  filePath: string;
  /** Service class declaration */
  classDeclaration: ts.ClassDeclaration;
  /** Method declaration being called */
  methodDeclaration: ts.MethodDeclaration;
}

export interface MethodCallChain {
  /** Original controller method */
  controllerMethod: ts.MethodDeclaration;
  /** Service calls in the chain */
  serviceCalls: ServiceCallInfo[];
  /** Final method that contains query builder (if found) */
  targetMethod: ts.MethodDeclaration | null;
}

export interface ServiceCallAnalyzerOptions {
  /** Maximum depth to traverse service calls */
  maxDepth?: number;
  /** Whether to analyze helper functions within service methods */
  analyzeHelpers?: boolean;
}

/**
 * Enhanced query builder analyzer that follows service calls
 */
export class ServiceCallAnalyzer {
  private checker: ts.TypeChecker;
  private program: ts.Program | null;
  private cache: Map<string, QueryBuilderSchema | null> = new Map();
  private analyzedMethods: Set<string> = new Set();

  constructor(checker: ts.TypeChecker, program: ts.Program | null) {
    this.checker = checker;
    this.program = program;
  }

  /**
   * Analyzes a controller method for query builder patterns, following service calls
   */
  public analyzeControllerMethod(
    methodDeclaration: ts.MethodDeclaration,
    options: ServiceCallAnalyzerOptions = {}
  ): QueryBuilderSchema | null {
    const cacheKey = this.getMethodCacheKey(methodDeclaration);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    const maxDepth = options.maxDepth ?? 3;
    const schema = this.analyzeMethodWithServiceCalls(methodDeclaration, 0, maxDepth, options);
    
    this.cache.set(cacheKey, schema);
    return schema;
  }

  /**
   * Recursively analyzes method with service call traversal
   */
  private analyzeMethodWithServiceCalls(
    methodDeclaration: ts.MethodDeclaration,
    currentDepth: number,
    maxDepth: number,
    options: ServiceCallAnalyzerOptions
  ): QueryBuilderSchema | null {
    // Prevent infinite recursion
    if (currentDepth >= maxDepth) {
      return null;
    }

    const methodKey = this.getMethodCacheKey(methodDeclaration);
    if (this.analyzedMethods.has(methodKey)) {
      return null; // Already analyzed this method
    }
    this.analyzedMethods.add(methodKey);

    // First, try direct query builder analysis
    const directSchema = analyzeQueryBuilderForSchema(methodDeclaration, this.checker);
    if (directSchema) {
      return directSchema;
    }

    // If no direct pattern, analyze service calls
    const serviceCalls = this.findServiceCalls(methodDeclaration);
    
    for (const serviceCall of serviceCalls) {
      const serviceSchema = this.analyzeServiceMethod(serviceCall, currentDepth, maxDepth, options);
      if (serviceSchema) {
        return serviceSchema;
      }
    }

    // If no service calls found and no direct pattern, return null
    return null;
  }

  /**
   * Analyzes a service method for query builder patterns
   */
  private analyzeServiceMethod(
    serviceCall: ServiceCallInfo,
    currentDepth: number,
    maxDepth: number,
    options: ServiceCallAnalyzerOptions
  ): QueryBuilderSchema | null {
    // Try direct analysis of the service method
    const directSchema = analyzeQueryBuilderForSchema(serviceCall.methodDeclaration, this.checker);
    if (directSchema) {
      return directSchema;
    }

    // If no direct pattern and we should analyze helpers, recurse
    if (options.analyzeHelpers) {
      return this.analyzeMethodWithServiceCalls(
        serviceCall.methodDeclaration,
        currentDepth + 1,
        maxDepth,
        options
      );
    }

    return null;
  }

  /**
   * Finds service calls in a method body
   */
  private findServiceCalls(methodDeclaration: ts.MethodDeclaration): ServiceCallInfo[] {
    const serviceCalls: ServiceCallInfo[] = [];
    const body = methodDeclaration.body;

    if (!body) {
      return serviceCalls;
    }

    const visitor = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const serviceCall = this.resolveServiceCall(node);
        if (serviceCall) {
          serviceCalls.push(serviceCall);
        }
      }

      ts.forEachChild(node, visitor);
    };

    ts.forEachChild(body, visitor);
    return serviceCalls;
  }

  /**
   * Resolves a call expression to a service method
   */
  private resolveServiceCall(callExpression: ts.CallExpression): ServiceCallInfo | null {
    // Handle direct method calls (e.g., service.method())
    if (ts.isPropertyAccessExpression(callExpression.expression)) {
      const propAccess = callExpression.expression;
      const methodName = propAccess.name.text;

      // Get the type of the object being accessed
      const objectType = this.checker.getTypeAtLocation(propAccess.expression);
      const objectSymbol = objectType.getSymbol();

      if (objectSymbol) {
        // Look for the class declaration
        const classDeclaration = this.findClassDeclaration(objectSymbol);
        if (classDeclaration) {
          const methodDeclaration = this.findMethodDeclaration(classDeclaration, methodName);
          if (methodDeclaration) {
            return {
              serviceName: classDeclaration.name?.text || "Unknown",
              methodName,
              filePath: classDeclaration.getSourceFile().fileName,
              classDeclaration,
              methodDeclaration
            };
          }
        }
      }
    }

    // Handle static method calls (e.g., ServiceClass.method())
    if (ts.isPropertyAccessExpression(callExpression.expression)) {
      const propAccess = callExpression.expression;
      const methodName = propAccess.name.text;

      if (ts.isIdentifier(propAccess.expression)) {
        const className = propAccess.expression.text;
        const classSymbol = this.checker.getSymbolAtLocation(propAccess.expression);

        if (classSymbol) {
          const classDeclaration = this.findClassDeclaration(classSymbol);
          if (classDeclaration && classDeclaration.name?.text === className) {
            const methodDeclaration = this.findMethodDeclaration(classDeclaration, methodName);
            if (methodDeclaration) {
              return {
                serviceName: className,
                methodName,
                filePath: classDeclaration.getSourceFile().fileName,
                classDeclaration,
                methodDeclaration
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Finds class declaration from a symbol
   */
  private findClassDeclaration(symbol: ts.Symbol): ts.ClassDeclaration | null {
    const declarations = symbol.getDeclarations();
    if (!declarations) return null;

    for (const declaration of declarations) {
      if (ts.isClassDeclaration(declaration)) {
        return declaration;
      }
    }

    return null;
  }

  /**
   * Finds method declaration in a class
   */
  private findMethodDeclaration(
    classDeclaration: ts.ClassDeclaration,
    methodName: string
  ): ts.MethodDeclaration | null {
    for (const member of classDeclaration.members) {
      if (ts.isMethodDeclaration(member) && member.name) {
        if (ts.isIdentifier(member.name) && member.name.text === methodName) {
          return member;
        }
      }
    }
    return null;
  }

  /**
   * Generates cache key for a method
   */
  private getMethodCacheKey(methodDeclaration: ts.MethodDeclaration): string {
    const sourceFile = methodDeclaration.getSourceFile();
    const className = this.getClassName(methodDeclaration);
    const methodName = methodDeclaration.name?.getText() || "unknown";
    const line = sourceFile.getLineAndCharacterOfPosition(methodDeclaration.getStart()).line;
    
    return `${sourceFile.fileName}:${className}:${methodName}:${line}`;
  }

  /**
   * Gets class name from method declaration
   */
  private getClassName(methodDeclaration: ts.MethodDeclaration): string {
    let node: ts.Node = methodDeclaration;
    
    while (node) {
      if (ts.isClassDeclaration(node)) {
        return node.name?.text || "Unknown";
      }
      node = node.parent;
    }
    
    return "Unknown";
  }

  /**
   * Clears the analysis cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.analyzedMethods.clear();
  }

  /**
   * Gets cache statistics
   */
  public getCacheStats(): { cached: number; analyzed: number } {
    return {
      cached: this.cache.size,
      analyzed: this.analyzedMethods.size
    };
  }
}

/**
 * Convenience function to create and use service call analyzer
 */
export function analyzeControllerWithServiceCalls(
  methodDeclaration: ts.MethodDeclaration,
  checker: ts.TypeChecker,
  program: ts.Program | null,
  options: ServiceCallAnalyzerOptions = {}
): QueryBuilderSchema | null {
  if (!program) {
    return null; // Cannot analyze service calls without program
  }
  
  const analyzer = new ServiceCallAnalyzer(checker, program);
  return analyzer.analyzeControllerMethod(methodDeclaration, options);
}

/**
 * Performance-optimized batch analysis for multiple controller methods
 */
export function analyzeMultipleControllersWithServiceCalls(
  methodDeclarations: ts.MethodDeclaration[],
  checker: ts.TypeChecker,
  program: ts.Program | null,
  options: ServiceCallAnalyzerOptions = {}
): Map<ts.MethodDeclaration, QueryBuilderSchema | null> {
  if (!program) {
    return new Map(methodDeclarations.map(method => [method, null]));
  }
  
  const analyzer = new ServiceCallAnalyzer(checker, program);
  const results = new Map<ts.MethodDeclaration, QueryBuilderSchema | null>();
  
  // Analyze methods in parallel where possible
  for (const method of methodDeclarations) {
    results.set(method, analyzer.analyzeControllerMethod(method, options));
  }
  
  return results;
}

/**
 * Clear all caches for memory optimization
 */
export function clearServiceCallAnalyzerCaches(): void {
  // This would be called periodically in large codebases
  // Implementation would depend on how caching is managed globally
}