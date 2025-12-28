import type { ResponsesSpec } from './responses';
import type { Schema } from '../validation/native/schema';
import type { ExtractPathParams } from '../core/typing/path-params';

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
  deprecated?: boolean;

  validate?: RouteValidate;
  bindings?: RouteBindings<Path>;

  responses?: ResponsesSpec;
  successStatus?: number;

  [k: string]: unknown;
};
