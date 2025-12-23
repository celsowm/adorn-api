/**
 * Type definitions for metadata stored via decorators
 */

import type { ParamSource } from './read';

export interface ControllerMetadata {
  path: string;
}

export interface RouteMetadata {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';
  path: string;
  statusCode?: number;
}

export interface ParamMetadata {
  index: number;
  source: ParamSource;
  name?: string;
}

export interface DtoPropertyMetadata {
  required: boolean;
  type?: string;
}
