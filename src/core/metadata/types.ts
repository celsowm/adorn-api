import type { ContractRef } from '../../contracts/types.js';

export type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'options'
  | 'head';

export interface ControllerMeta {
  basePath?: string;
  tags?: string[];
}

export interface ResponseMeta {
  status: number;
  description?: string;
}

export interface RequestBodyMeta {
  required?: boolean;
  description?: string;
  contentType?: string;
}

export interface MethodMeta {
  method?: HttpMethod;
  path?: string;
  contract?: ContractRef;
  tags?: string[];
  summary?: string;
  deprecated?: boolean;
  requestBody?: boolean | RequestBodyMeta;
  responses?: ResponseMeta[];
}

export interface RouteDefinition extends MethodMeta {
  controller: Function;
  handler: PropertyKey;
  method: HttpMethod;
  path: string;
  fullPath: string;
}

export interface ControllerDefinition {
  controller: Function;
  meta: ControllerMeta;
  methods: Map<PropertyKey, MethodMeta>;
  routes: RouteDefinition[];
}

export interface RouteRegistry {
  controllers: ControllerDefinition[];
  routes: RouteDefinition[];
}
