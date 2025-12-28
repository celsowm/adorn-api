import type { ResponsesSpec } from './responses.js';
import type { Schema } from '../validation/native/schema.js';
import type { ExtractPathParams } from '../core/typing/path-params.js';
import type { SecurityRequirementObject } from './openapi-v3.js';

export type ScalarHint = 'string' | 'int' | 'number' | 'boolean' | 'uuid';

export type RouteValidate = {
  params?: Schema<any>;
  query?: Schema<any>;
  body?: Schema<any>;
};

export type RouteBindings<Path extends string> = {
  path?: Partial<Record<ExtractPathParams<Path>, ScalarHint>>;
};

export type RouteOptions<Path extends string = string> = {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  security?: SecurityRequirementObject[];

  validate?: RouteValidate;
  bindings?: RouteBindings<Path>;

  responses?: ResponsesSpec;
  successStatus?: number;

  [k: string]: unknown;
};
