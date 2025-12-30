export type HttpMethod = 
  | "GET" 
  | "POST" 
  | "PUT" 
  | "PATCH" 
  | "DELETE" 
  | "OPTIONS" 
  | "HEAD";

export interface RouteOperation {
  httpMethod: HttpMethod;
  path: string;
  methodName: string;
  operationId?: string;
}

export interface AdornBucket {
  basePath?: string;
  ops: RouteOperation[];
}
