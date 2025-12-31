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
  use?: Array<string | ExpressMw>;
  auth?: AuthMeta | "public";
}

export interface AuthMeta {
  scheme: string;
  scopes?: string[];
  optional?: boolean;
}

export type ExpressMw = (req: any, res: any, next: (err?: any) => void) => any;

export interface AdornBucket {
  basePath?: string;
  controllerUse?: Array<string | ExpressMw>;
  ops: RouteOperation[];
}
