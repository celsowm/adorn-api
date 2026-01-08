/**
 * Query Builder Schema Analyzer
 * Parses method bodies to detect selectFromEntity patterns and extract schema information
 * Supports variable reassignment patterns (e.g., let qb = selectFromEntity(); qb = qb.select())
 *
 * Improvements made:
 * - Fixed variable tracking to support reassignments like "let qb = selectFromEntity(Entity); qb = qb.select(...)"
 * - Enhanced `extractChainedOperation` to detect both direct calls and method chains
 * - Added proper handling for selectFromEntity/selectFrom patterns in variable initialization
 * - Fixed PaginatedResult schema filtering to properly filter items array instead of wrapper
 */

import ts from "typescript";
import { analyzeControllerWithServiceCalls } from "./serviceCallAnalyzer.js";

/**
 * Represents a schema extracted from a query builder chain
 */
export interface QueryBuilderSchema {
  /** Entity class name (e.g., "BlogPost") */
  entityName: string;
  /** Fields selected via .select() calls */
  selectedFields: string[];
  /** Relations included via .include() calls */
  includes: Record<string, QueryBuilderSchema | boolean>;
  /** Whether query ends with .executePaged() instead of .execute() */
  isPaged: boolean;
}

/**
 * Result of query builder analysis including operation details for logging
 */
export interface QueryBuilderAnalysisResult {
  /** Whether a query builder pattern was detected */
  detected: boolean;
  /** Schema information if detected */
  schema: QueryBuilderSchema | null;
  /** Operation method name (for logging) */
  methodName?: string;
  /** Operation HTTP method (for logging) */
  httpMethod?: string;
  /** Operation path (for logging) */
  path?: string;
  /** Operation ID (for logging) */
  operationId?: string;
}

/**
 * Analysis options for query builder detection
 */
export interface QueryBuilderAnalyzerOptions {
  /** Maximum depth to traverse for nested includes */
  maxDepth?: number;
}

/**
 * Analyzes a method declaration to detect query builder patterns and extract schema
 * Supports variable reassignment patterns (e.g., let qb = selectFromEntity(); qb = qb.select())
 *
 * @param methodDeclaration - The method declaration to analyze
 * @param checker - TypeScript type checker
 * @param options - Analyzer options
 * @returns Query builder schema if pattern detected, null otherwise
 */
export function analyzeQueryBuilderForSchema(
  methodDeclaration: ts.MethodDeclaration,
  checker: ts.TypeChecker,
  options: QueryBuilderAnalyzerOptions = {}
): QueryBuilderSchema | null {
  const body = methodDeclaration.body;
  if (!body) {
    return null;
  }

  // Try to analyze with variable tracking (supports reassignments)
  const trackedSchema = analyzeWithVariableTracking(body, checker, options);
  if (trackedSchema) {
    return trackedSchema;
  }

  // Fall back to direct call chain analysis (no variable tracking)
  const returnStatement = findReturnStatement(body);
  if (!returnStatement) {
    return null;
  }

  const callChain = analyzeReturnExpression(returnStatement.expression);
  if (!callChain) {
    return null;
  }

  // Parse chain to extract schema information
  return parseQueryBuilderChain(callChain, checker, options);
}

/**
 * Analyzes a method declaration and returns detailed result with operation info
 * Useful for logging and statistics
 *
 * @param methodDeclaration - The method declaration to analyze
 * @param checker - TypeScript type checker
 * @param options - Analyzer options
 * @param operationInfo - Optional operation metadata for logging
 * @returns Detailed analysis result with operation info
 */
export function analyzeQueryBuilderWithDetails(
  methodDeclaration: ts.MethodDeclaration,
  checker: ts.TypeChecker,
  options: QueryBuilderAnalyzerOptions = {},
  operationInfo?: { methodName?: string; httpMethod?: string; path?: string; operationId?: string }
): QueryBuilderAnalysisResult {
  const schema = analyzeQueryBuilderForSchema(methodDeclaration, checker, options);
  
  return {
    detected: schema !== null,
    schema,
    ...operationInfo
  };
}

/**
 * Enhanced analysis that follows service calls to detect query builder patterns
 *
 * @param methodDeclaration - The method declaration to analyze
 * @param checker - TypeScript type checker
 * @param program - TypeScript program for AST traversal
 * @param options - Analyzer options including service call traversal settings
 * @param operationInfo - Optional operation metadata for logging
 * @returns Detailed analysis result with operation info
 */
export function analyzeQueryBuilderWithServiceCalls(
  methodDeclaration: ts.MethodDeclaration,
  checker: ts.TypeChecker,
  program: ts.Program | null,
  options: QueryBuilderAnalyzerOptions & {
    maxDepth?: number;
    analyzeHelpers?: boolean;
  } = {},
  operationInfo?: { methodName?: string; httpMethod?: string; path?: string; operationId?: string }
): QueryBuilderAnalysisResult {
  // Try direct analysis first
  let schema = analyzeQueryBuilderForSchema(methodDeclaration, checker, options);
  
  // If no direct pattern found and service call analysis is enabled, try enhanced analysis
  if (!schema && program) {
    try {
      schema = analyzeControllerWithServiceCalls(methodDeclaration, checker, program, {
        maxDepth: options.maxDepth,
        analyzeHelpers: options.analyzeHelpers
      });
    } catch (error) {
      // Service call analysis failed, fall back to direct analysis
      console.warn("Service call analysis failed:", error);
    }
  }
  
  return {
    detected: schema !== null,
    schema,
    ...operationInfo
  };
}

/**
 * Analyzes method body with variable tracking to support reassignments
 * Handles patterns like: let qb = selectFromEntity(Entity); qb = qb.select(...);
 */
function analyzeWithVariableTracking(
  body: ts.Block,
  checker: ts.TypeChecker,
  options: QueryBuilderAnalyzerOptions
): QueryBuilderSchema | null {
  let queryBuilderVar: string | null = null;
  let entityName: string | null = null;
  const selectedFields = new Set<string>();
  const includes: Record<string, QueryBuilderSchema | boolean> = {};
  let isPaged = false;
  let hasReturn = false;

  for (const statement of body.statements) {
    // Handle return statements first
    if (ts.isReturnStatement(statement)) {
      hasReturn = true;
      const returnExpr = statement.expression;

      // Check if return is a method call on our tracked variable
      if (returnExpr && ts.isCallExpression(returnExpr)) {
        const callExpr = returnExpr;

        // Handle qb.executePaged() or qb.execute()
        if (ts.isIdentifier(callExpr.expression) && queryBuilderVar) {
          const varName = callExpr.expression.text;

          if (varName === queryBuilderVar) {
            const methodName = callExpr.expression.text;

            // Track executePaged to distinguish from execute
            if (methodName === "executePaged") {
              isPaged = true;
            }
          }
        }

        // Handle chained calls like qb.select(...).executePaged()
        if (ts.isPropertyAccessExpression(callExpr.expression) && queryBuilderVar) {
          const propAccess = callExpr.expression;

          if (ts.isIdentifier(propAccess.expression) && propAccess.expression.text === queryBuilderVar) {
            const methodName = propAccess.name.text;

            if (methodName === "executePaged") {
              isPaged = true;
            }
          }
        }
      }

      continue;
    }

    // Handle expression statements (assignments, etc.)
    if (!ts.isExpressionStatement(statement)) {
      // Try to handle variable declarations
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) continue;
          
          const varName = declaration.name.text;
          const initializer = declaration.initializer;
          
          if (!initializer || !ts.isCallExpression(initializer)) continue;
          
          const opInfo = extractChainedOperation(initializer);
          
          if (opInfo && (opInfo.operation === "selectFromEntity" || opInfo.operation === "selectFrom")) {
            queryBuilderVar = varName;
            if (opInfo.entityName) {
              entityName = opInfo.entityName;
            }
          }
        }
      }
      continue;
    }

    const expr = statement.expression;

    // Check if this is a variable assignment (let qb = ... or qb = ...)
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      if (!ts.isIdentifier(expr.left)) {
        continue;
      }

      const varName = expr.left.text;
      const rightSide = expr.right;

      // Check if right side is a query builder call (initialization or method call)
      if (ts.isCallExpression(rightSide)) {
        const opInfo = extractChainedOperation(rightSide);

        if (opInfo) {
          // Handle query builder initialization (selectFromEntity or selectFrom)
          if (opInfo.operation === "selectFromEntity" || opInfo.operation === "selectFrom") {
            // Track the variable that holds the query builder
            queryBuilderVar = varName;

            // Extract entity name
            if (opInfo.entityName) {
              entityName = opInfo.entityName;
            }
          }

          // Handle chained method calls on our tracked variable
          // e.g., qb = qb.select("field1", "field2")
          if ((opInfo.operation === "select" || opInfo.operation === "include") && queryBuilderVar === varName) {
            if (opInfo.operation === "select") {
              for (const field of opInfo.fields || []) {
                selectedFields.add(field);
              }
            } else if (opInfo.operation === "include" && opInfo.includeArg) {
              const parsedIncludes = parseIncludeObjectLiteral(opInfo.includeArg);
              if (parsedIncludes) {
                for (const [relName, relSchema] of Object.entries(parsedIncludes)) {
                  includes[relName] = relSchema;
                }
              }
            }
          }
        }
      }
    }
  }

  // Must have found a return statement and a valid query builder pattern
  if (!hasReturn || !queryBuilderVar || !entityName) {
    return null;
  }

  return {
    entityName,
    selectedFields: Array.from(selectedFields),
    includes,
    isPaged
  };
}

/**
 * Checks if an expression is a query builder operation on a variable
 */
function isQueryBuilderOperation(
  expr: ts.Expression,
  varName: string
): boolean {
  const opInfo = extractQueryBuilderOperation(expr, varName);
  return opInfo.type !== "unknown";
}

/**
 * Extracts information from a query builder operation
 */
interface QueryBuilderOperation {
  type: "selectFromEntity" | "selectFrom" | "select" | "include" | "executePaged" | "unknown";
  entityName: string | null;
  fields: string[] | null;
  includes: Record<string, QueryBuilderSchema | boolean> | null;
}

/**
 * Information about a chained operation (e.g., qb.select() or qb.include())
 */
interface ChainedOperation {
  operation: "select" | "include" | "selectFromEntity" | "selectFrom";
  fields: string[] | null;
  includeArg: ts.Expression | null;
  entityName: string | null;
}

/**
 * Extracts information from a chained method call on a variable
 * e.g., qb.select("field1", "field2") or qb.include({...}) or qb.selectFromEntity(Entity)
 */
function extractChainedOperation(callExpr: ts.CallExpression): ChainedOperation | null {
  // Check for direct call to selectFromEntity or selectFrom
  // This handles patterns like: qb = selectFromEntity(Entity)
  if (ts.isIdentifier(callExpr.expression)) {
    const methodName = callExpr.expression.text;

    if (methodName === "selectFromEntity" || methodName === "selectFrom") {
      const entityArg = callExpr.arguments[0];
      let entityName: string | null = null;

      if (ts.isIdentifier(entityArg)) {
        entityName = entityArg.text;
      } else if (ts.isPropertyAccessExpression(entityArg)) {
        entityName = entityArg.name.text;
      }

      return {
        operation: methodName === "selectFromEntity" ? "selectFromEntity" : "selectFrom",
        fields: null,
        includeArg: null,
        entityName
      };
    }
  }

  // Check for property access (method calls on variables)
  if (!ts.isPropertyAccessExpression(callExpr.expression)) {
    return null;
  }

  const propAccess = callExpr.expression;
  const methodName = propAccess.name.text;

  if (methodName === "select") {
    const fields: string[] = [];
    for (const arg of callExpr.arguments) {
      if (ts.isStringLiteral(arg)) {
        fields.push(arg.text);
      }
    }
    return {
      operation: "select",
      fields,
      includeArg: null,
      entityName: null
    };
  }

  if (methodName === "include") {
    return {
      operation: "include",
      fields: null,
      includeArg: callExpr.arguments[0] || null,
      entityName: null
    };
  }

  return null;
}

function extractQueryBuilderOperation(
  expr: ts.Expression,
  varName: string
): QueryBuilderOperation {
  // Check for selectFromEntity(Entity) or selectFrom(Entity)
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    const methodName = expr.expression.text;
    
    if (methodName === "selectFromEntity" || methodName === "selectFrom") {
      const entityArg = expr.arguments[0];
      let entityName: string | null = null;
      
      if (ts.isIdentifier(entityArg)) {
        entityName = entityArg.text;
      } else if (ts.isPropertyAccessExpression(entityArg)) {
        entityName = entityArg.name.text;
      }
      
      return {
        type: methodName,
        entityName,
        fields: null,
        includes: null
      };
    }
  }

  // Check for variable.select("field1", "field2")
  if (ts.isCallExpression(expr)) {
    const callExpr = expr;
    
    if (ts.isPropertyAccessExpression(callExpr.expression)) {
      const methodName = callExpr.expression.name.text;
      
      if (methodName === "select") {
        const fields: string[] = [];
        
        for (const arg of callExpr.arguments) {
          if (ts.isStringLiteral(arg)) {
            fields.push(arg.text);
          }
        }
        
        return {
          type: "select",
          entityName: null,
          fields,
          includes: null
        };
      }
      
      if (methodName === "include") {
        const includes = parseIncludeObjectLiteral(callExpr.arguments[0]);
        
        return {
          type: "include",
          entityName: null,
          fields: null,
          includes
        };
      }
      
      if (methodName === "executePaged") {
        return {
          type: "executePaged",
          entityName: null,
          fields: null,
          includes: null
        };
      }
    }
  }

  return {
    type: "unknown",
    entityName: null,
    fields: null,
    includes: null
  };
}

/**
 * Parses an include object literal
 */
function parseIncludeObjectLiteral(
  arg: ts.Expression
): Record<string, QueryBuilderSchema | boolean> | null {
  if (!ts.isObjectLiteralExpression(arg)) {
    return null;
  }

  const includes: Record<string, QueryBuilderSchema | boolean> = {};

  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      continue;
    }

    const relationName = prop.name.text;
    const value = prop.initializer;

    if (value.kind === ts.SyntaxKind.TrueKeyword) {
      includes[relationName] = true;
    } else if (ts.isObjectLiteralExpression(value)) {
      const nestedSchema = parseNestedInclude(value, 0);
      if (nestedSchema) {
        includes[relationName] = nestedSchema;
      }
    }
  }

  return includes;
}

/**
 * Parses a nested include with field selection
 */
function parseNestedInclude(
  obj: ts.ObjectLiteralExpression,
  depth: number
): QueryBuilderSchema | null {
  const selectedFields: string[] = [];
  const includes: Record<string, QueryBuilderSchema | boolean> = {};

  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      continue;
    }

    const propName = prop.name.text;
    const value = prop.initializer;

    if (propName === "select" && ts.isArrayLiteralExpression(value)) {
      for (const element of value.elements) {
        if (ts.isStringLiteral(element)) {
          selectedFields.push(element.text);
        }
      }
    } else if (propName === "include" && ts.isObjectLiteralExpression(value)) {
      const nestedIncludes = parseIncludeObjectLiteral(value);
      if (nestedIncludes) {
        for (const [relName, relSchema] of Object.entries(nestedIncludes)) {
          includes[relName] = relSchema;
        }
      }
    }
  }

  return {
    entityName: "",
    selectedFields,
    includes,
    isPaged: false
  };
}

/**
 * Extracts method name from an expression
 */
function getMethodName(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }

  return null;
}

/**
 * Finds the single return statement in a method body
 */
function findReturnStatement(body: ts.Block): ts.ReturnStatement | null {
  let returnStatement: ts.ReturnStatement | null = null;
  
  for (const statement of body.statements) {
    if (ts.isReturnStatement(statement)) {
      if (returnStatement !== null) {
        // Multiple return statements - too complex
        return null;
      }
      returnStatement = statement;
    }
  }
  
  return returnStatement;
}

/**
 * Analyzes a return expression to extract query builder call chain
 */
interface CallChainNode {
  expression: ts.Expression;
  methodName: string | null;
  arguments: ts.NodeArray<ts.Expression>;
  parent: CallChainNode | null;
}

function analyzeReturnExpression(expression: ts.Expression | undefined): CallChainNode | null {
  if (!expression) {
    return null;
  }

  // Check if it's a call expression (simple case)
  if (ts.isCallExpression(expression)) {
    return buildCallChain(expression, null);
  }

  return null;
}

/**
 * Builds a call chain from a call expression
 */
function buildCallChain(
  node: ts.Expression,
  parent: CallChainNode | null
): CallChainNode | null {
  if (ts.isCallExpression(node)) {
    const callNode: CallChainNode = {
      expression: node.expression,
      methodName: getMethodName(node.expression),
      arguments: node.arguments,
      parent
    };

    // Check if we have a property access chain (e.g., selectFromEntity(Entity).select(...))
    if (ts.isPropertyAccessExpression(node.expression)) {
      return buildCallChain(node.expression.expression, callNode);
    }

    return callNode;
  }

  return parent;
}

/**
 * Parses a query builder call chain to extract schema information
 */
function parseQueryBuilderChain(
  chain: CallChainNode | null,
  checker: ts.TypeChecker,
  options: QueryBuilderAnalyzerOptions
): QueryBuilderSchema | null {
  if (!chain) {
    return null;
  }

  // Find the root (selectFromEntity or selectFrom call)
  const rootNode = findSelectFromEntityCall(chain);
  if (!rootNode) {
    return null;
  }

  // Extract entity name from selectFromEntity call
  const entityName = extractEntityName(rootNode, checker);
  if (!entityName) {
    return null;
  }

  // Traverse chain to find .select() and .include() calls
  const selectedFields = new Set<string>();
  const includes: Record<string, QueryBuilderSchema | boolean> = {};
  let isPaged = false;

  let currentNode: CallChainNode | null = chain;
  while (currentNode) {
    const methodName = currentNode.methodName;

    if (methodName === "select") {
      // Extract field names from .select() arguments
      for (const arg of currentNode.arguments) {
        if (ts.isStringLiteral(arg)) {
          selectedFields.add(arg.text);
        }
      }
    } else if (methodName === "include") {
      // Extract include specifications from .include() arguments
      parseIncludeArgument(currentNode.arguments[0], includes, checker, options, 0);
    } else if (methodName === "executePaged") {
      isPaged = true;
    }

    currentNode = currentNode.parent;
  }

  return {
    entityName,
    selectedFields: Array.from(selectedFields),
    includes,
    isPaged
  };
}

/**
 * Finds selectFromEntity call in a chain (the root)
 */
function findSelectFromEntityCall(chain: CallChainNode | null): CallChainNode | null {
  let currentNode: CallChainNode | null = chain;
  let lastNode: CallChainNode | null = null;

  while (currentNode) {
    if (currentNode.methodName === "selectFromEntity" || 
        currentNode.methodName === "selectFrom") {
      return currentNode;
    }
    lastNode = currentNode;
    currentNode = currentNode.parent;
  }

  return lastNode;
}

/**
 * Extracts entity name from selectFromEntity(Entity) call
 */
function extractEntityName(
  callNode: CallChainNode,
  checker: ts.TypeChecker
): string | null {
  if (callNode.arguments.length === 0) {
    return null;
  }

  const entityArg = callNode.arguments[0];

  // Handle identifier (direct entity class reference)
  if (ts.isIdentifier(entityArg)) {
    return entityArg.text;
  }

  // Handle property access (e.g., Entities.BlogPost)
  if (ts.isPropertyAccessExpression(entityArg)) {
    return entityArg.name.text;
  }

  return null;
}

/**
 * Parses argument to .include() to extract relation specifications
 */
function parseIncludeArgument(
  arg: ts.Expression | undefined,
  includes: Record<string, QueryBuilderSchema | boolean>,
  checker: ts.TypeChecker,
  options: QueryBuilderAnalyzerOptions,
  depth: number
): void {
  if (!arg) {
    return;
  }

  // Handle object literal: { author: true, category: { select: [...] } }
  if (ts.isObjectLiteralExpression(arg)) {
    for (const prop of arg.properties) {
      if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
        continue;
      }

      const relationName = prop.name.text;
      const value = prop.initializer;

      if (value.kind === ts.SyntaxKind.TrueKeyword) {
        // Simple include: { author: true }
        includes[relationName] = true;
      } else if (ts.isObjectLiteralExpression(value)) {
        // Nested include with options: { category: { select: [...] } }
        const maxDepth = options.maxDepth ?? 5;
        if (depth < maxDepth) {
          const nestedSchema = parseNestedInclude(value, depth + 1);
          if (nestedSchema) {
            includes[relationName] = nestedSchema;
          }
        }
      }
    }
  }
}