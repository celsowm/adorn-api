/**
 * Graph builder that converts CST/AST to graph-based IR.
 * Creates typed nodes and establishes relationships between them.
 */
import ts from "typescript";
import type { 
  Graph, 
  AnyNode, 
  ControllerNode, 
  OperationNode, 
  ParameterNode, 
  TypeDefinitionNode,
  NodeKind 
} from "./types.js";
import {
  createGraph,
  generateNodeId,
  addNode,
  addEdge,
  getNodesByKind
} from "./types.js";

/**
 * Builder context for constructing the graph
 */
export interface GraphBuilderContext {
  graph: Graph;
  checker: ts.TypeChecker;
  sourceFiles: ts.SourceFile[];
  nodeMap: Map<ts.Node, string>; // Maps AST nodes to graph node IDs
}

/**
 * Create a new graph builder context
 */
export function createGraphBuilderContext(
  checker: ts.TypeChecker,
  sourceFiles: ts.SourceFile[],
  tsVersion?: string
): GraphBuilderContext {
  return {
    graph: createGraph(tsVersion),
    checker,
    sourceFiles,
    nodeMap: new Map(),
  };
}

/**
 * Build the graph from source files
 */
export function buildGraph(context: GraphBuilderContext): Graph {
  for (const sourceFile of context.sourceFiles) {
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        if (isControllerClass(node)) {
          buildControllerNode(node, context);
        } else {
          buildTypeDefinitionNode(node, context);
        }
      } else if (ts.isInterfaceDeclaration(node) && node.name) {
        buildInterfaceNode(node, context);
      } else if (ts.isTypeAliasDeclaration(node) && node.name) {
        buildTypeAliasNode(node, context);
      } else if (ts.isEnumDeclaration(node) && node.name) {
        buildEnumNode(node, context);
      }
    });
  }

  return context.graph;
}

/**
 * Check if a class is decorated with @Controller
 */
function isControllerClass(node: ts.ClassDeclaration): boolean {
  const decorators = ts.getDecorators(node);
  if (!decorators) return false;

  return decorators.some(decorator => {
    if (ts.isCallExpression(decorator.expression)) {
      const expr = decorator.expression.expression;
      return ts.isIdentifier(expr) && expr.text === "Controller";
    }
    return false;
  });
}

/**
 * Build a controller node from a class declaration
 */
function buildControllerNode(
  node: ts.ClassDeclaration,
  context: GraphBuilderContext
): void {
  if (!node.name) return;

  const controllerId = generateNodeId('Controller', node.name.text);

  const controllerNode: ControllerNode = {
    id: controllerId,
    kind: 'Controller',
    metadata: {
      name: node.name.text,
      sourceLocation: getLocation(node, context),
      tags: new Set(['controller']),
    },
    edges: [],
    controller: {
      basePath: extractControllerPath(node) || '/',
      consumes: extractClassConsumes(node),
      produces: extractClassProduces(node),
    },
  };

  addNode(context.graph, controllerNode);
  context.nodeMap.set(node, controllerId);
  context.graph.roots.add(controllerId);

  for (const member of node.members) {
    if (ts.isMethodDeclaration(member) && member.name) {
      const operationId = buildOperationNode(member, controllerId, context);
      if (operationId) {
        addEdge(context.graph, controllerId, operationId, 'contains');
      }
    }
  }
}

/**
 * Build an operation node from a method declaration
 */
function buildOperationNode(
  node: ts.MethodDeclaration,
  controllerId: string,
  context: GraphBuilderContext
): string | null {
  const methodName = ts.isIdentifier(node.name) ? node.name.text : null;
  if (!methodName) return null;

  const httpMethods = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
  let httpMethod: string | null = null;
  let path = '/';

  const decorators = ts.getDecorators(node);
  if (decorators) {
    for (const decorator of decorators) {
      if (ts.isCallExpression(decorator.expression)) {
        const expr = decorator.expression.expression;
        if (ts.isIdentifier(expr) && httpMethods.includes(expr.text)) {
          httpMethod = expr.text.toUpperCase();
          path = extractDecoratorStringArg(decorator) || '/';
          break;
        }
      }
    }
  }

  if (!httpMethod) return null;

  const signature = context.checker.getSignatureFromDeclaration(node);
  if (!signature) return null;

  const operationId = generateNodeId('Operation', methodName);

  const operationNode: OperationNode = {
    id: operationId,
    kind: 'Operation',
    metadata: {
      name: methodName,
      sourceLocation: getLocation(node, context),
      tags: new Set(['operation']),
    },
    edges: [],
    operation: {
      httpMethod,
      path,
      operationId: `${methodName}_${httpMethod.toLowerCase()}`,
      returnType: '', // Will be filled in type resolution
    },
  };

  addNode(context.graph, operationNode);
  context.nodeMap.set(node, operationId);

  for (let i = 0; i < node.parameters.length; i++) {
    const param = node.parameters[i];
    const paramName = ts.isIdentifier(param.name) ? param.name.text : `param${i}`;
    const paramId = buildParameterNode(param, i, paramName, context);
    
    if (paramId) {
      addEdge(context.graph, operationId, paramId, 'contains');
    }
  }

  return operationId;
}

/**
 * Build a parameter node from a parameter declaration
 */
function buildParameterNode(
  node: ts.ParameterDeclaration,
  index: number,
  name: string,
  context: GraphBuilderContext
): string | null {
  const paramId = generateNodeId('Parameter', name);
  
  const paramNode: ParameterNode = {
    id: paramId,
    kind: 'Parameter',
    metadata: {
      name,
      sourceLocation: getLocation(node, context),
    },
    edges: [],
    parameter: {
      index,
      location: 'path',
      type: '', // Will be filled in type resolution
      isOptional: !!node.questionToken || !!node.initializer,
    },
  };

  addNode(context.graph, paramNode);
  context.nodeMap.set(node, paramId);

  // Add edge to type definition (will be resolved later)
  const typeId = generateNodeId('TypeDefinition', 'unknown');
  addEdge(context.graph, paramId, typeId, 'uses');

  return paramId;
}

/**
 * Build a type definition node from a class declaration
 */
function buildTypeDefinitionNode(
  node: ts.ClassDeclaration,
  context: GraphBuilderContext
): void {
  if (!node.name) return;

  const typeId = generateNodeId('TypeDefinition', node.name.text);

  const typeNode: TypeDefinitionNode = {
    id: typeId,
    kind: 'TypeDefinition',
    metadata: {
      name: node.name.text,
      sourceLocation: getLocation(node, context),
      tags: new Set(['type', 'class']),
    },
    edges: [],
    typeDef: {
      isGeneric: node.typeParameters !== undefined && node.typeParameters.length > 0,
      typeParameters: node.typeParameters?.map(tp => 
        ts.isIdentifier(tp.name) ? tp.name.text : 'T'
      ),
      properties: new Map(),
    },
  };

  addNode(context.graph, typeNode);
  context.nodeMap.set(node, typeId);
}

/**
 * Build an interface node
 */
function buildInterfaceNode(
  node: ts.InterfaceDeclaration,
  context: GraphBuilderContext
): void {
  if (!node.name) return;

  const typeId = generateNodeId('Interface', node.name.text);

  const typeNode: TypeDefinitionNode = {
    id: typeId,
    kind: 'TypeDefinition',
    metadata: {
      name: node.name.text,
      sourceLocation: getLocation(node, context),
      tags: new Set(['type', 'interface']),
    },
    edges: [],
    typeDef: {
      isGeneric: node.typeParameters !== undefined && node.typeParameters.length > 0,
      typeParameters: node.typeParameters?.map(tp => 
        ts.isIdentifier(tp.name) ? tp.name.text : 'T'
      ),
    },
  };

  addNode(context.graph, typeNode);
  context.nodeMap.set(node, typeId);
}

/**
 * Build a type alias node
 */
function buildTypeAliasNode(
  node: ts.TypeAliasDeclaration,
  context: GraphBuilderContext
): void {
  if (!node.name) return;

  const typeId = generateNodeId('TypeDefinition', node.name.text);

  const typeNode: TypeDefinitionNode = {
    id: typeId,
    kind: 'TypeDefinition',
    metadata: {
      name: node.name.text,
      sourceLocation: getLocation(node, context),
      tags: new Set(['type', 'alias']),
    },
    edges: [],
    typeDef: {
      isGeneric: node.typeParameters !== undefined && node.typeParameters.length > 0,
    },
  };

  addNode(context.graph, typeNode);
  context.nodeMap.set(node, typeId);
}

/**
 * Build an enum node
 */
function buildEnumNode(
  node: ts.EnumDeclaration,
  context: GraphBuilderContext
): void {
  if (!node.name) return;

  const typeId = generateNodeId('TypeDefinition', node.name.text);

  const typeNode: TypeDefinitionNode = {
    id: typeId,
    kind: 'TypeDefinition',
    metadata: {
      name: node.name.text,
      sourceLocation: getLocation(node, context),
      tags: new Set(['type', 'enum']),
    },
    edges: [],
    typeDef: {
      isGeneric: false,
    },
  };

  addNode(context.graph, typeNode);
  context.nodeMap.set(node, typeId);
}

/**
 * Get source location from a node
 */
function getLocation(
  node: ts.Node,
  context: GraphBuilderContext
): { filePath: string; line: number; column: number } {
  const sourceFile = node.getSourceFile();
  const pos = node.getStart();
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  
  return {
    filePath: sourceFile.fileName,
    line: line + 1,
    column: character + 1,
  };
}

/**
 * Extract controller base path from decorator
 */
function extractControllerPath(node: ts.ClassDeclaration): string | null {
  const decorators = ts.getDecorators(node);
  if (!decorators) return null;

  for (const decorator of decorators) {
    if (ts.isCallExpression(decorator.expression)) {
      const expr = decorator.expression.expression;
      if (ts.isIdentifier(expr) && expr.text === "Controller") {
        return extractDecoratorStringArg(decorator);
      }
    }
  }

  return null;
}

/**
 * Extract string argument from decorator
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
 * Extract @Consumes decorator content types
 */
function extractClassConsumes(node: ts.ClassDeclaration): string[] | undefined {
  const decorators = ts.getDecorators(node);
  if (!decorators) return undefined;

  for (const decorator of decorators) {
    if (ts.isCallExpression(decorator.expression)) {
      const expr = decorator.expression.expression;
      if (ts.isIdentifier(expr) && expr.text === "Consumes") {
        const arg = decorator.expression.arguments[0];
        if (ts.isStringLiteral(arg)) {
          return [arg.text];
        }
        if (ts.isArrayLiteralExpression(arg)) {
          return arg.elements
            .filter(ts.isStringLiteral)
            .map(e => e.text);
        }
      }
    }
  }

  return undefined;
}

/**
 * Extract @Produces decorator content types
 */
function extractClassProduces(node: ts.ClassDeclaration): string[] | undefined {
  const decorators = ts.getDecorators(node);
  if (!decorators) return undefined;

  for (const decorator of decorators) {
    if (ts.isCallExpression(decorator.expression)) {
      const expr = decorator.expression.expression;
      if (ts.isIdentifier(expr) && expr.text === "Produces") {
        const arg = decorator.expression.arguments[0];
        if (ts.isStringLiteral(arg)) {
          return [arg.text];
        }
        if (ts.isArrayLiteralExpression(arg)) {
          return arg.elements
            .filter(ts.isStringLiteral)
            .map(e => e.text);
        }
      }
    }
  }

  return undefined;
}
