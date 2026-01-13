export interface ControllerMetadata {
  path: string;
  middlewares: Function[];
  guards: Function[];
}

export interface RouteMetadata {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  handlerName: string;
  summary?: string;
  description?: string;
  tags?: string[];
  middlewares: Function[];
  guards: Function[];
  parameters: ParameterMetadata[];
  response?: ResponseMetadata;
}

export interface ParameterMetadata {
  name: string;
  type: 'param' | 'query' | 'body' | 'header';
  index: number;
  schema?: any;
  required?: boolean;
}

export interface ResponseMetadata {
  status: number;
  description?: string;
  schema?: any;
  isArray?: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
