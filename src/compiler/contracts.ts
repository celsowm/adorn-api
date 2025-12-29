import type * as ts from 'typescript';

export type ScalarHint = 'string' | 'int' | 'number' | 'boolean' | 'uuid';

export type HttpDecoratorName = 'Get' | 'Post' | 'Put' | 'Patch' | 'Delete';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type PluginConfig = {
  packageName?: string;
  emitAnalysisFile?: string;
  includeNodeModules?: boolean;
};

export type ParamModel = {
  name: string;
  typeText: string;
  isOptional: boolean;
};

export type ReturnModel = {
  typeText: string;
  unwrappedTypeText: string;
  isPromise: boolean;
};

export type RouteModel = {
  fileName: string;
  className: string;
  methodName: string;

  httpDecorator: HttpDecoratorName;
  httpMethod: HttpMethod;
  path: string;

  pathTokens: string[];
  pathHints: Record<string, ScalarHint | undefined>;

  params: ParamModel[];
  returns: ReturnModel;
};

export type RouteMatch = {
  sourceFile: ts.SourceFile;
  className: string;
  methodDecl: ts.MethodDeclaration;
  methodName: string;
  decoratorName: HttpDecoratorName;
  decoratorCall: ts.CallExpression;
  path: string;
};
