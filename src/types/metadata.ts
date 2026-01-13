export interface ControllerMetadata {
  path: string;
  middlewares: Function[];
  guards: Function[];
}

export interface RouteMetadata {
  path: string;
  method: HttpMethod;
  handlerName: string;
  summary?: string;
  description?: string;
  tags?: string[];
  middlewares: Function[];
  guards: Function[];
  parameters: ParameterMetadata[];
  response?: ResponseMetadata;
  schemas?: SchemaConfig;
}

export interface ParameterMetadata {
  name: string;
  type: 'query' | 'body' | 'params' | 'combined';
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

export interface SchemaConfig {
  params?: any;
  body?: any;
  query?: any;
}

export interface ValidatedInput<
  P = unknown,
  B = unknown,
  Q = unknown
> {
  params: P;
  body: B;
  query: Q;
}
