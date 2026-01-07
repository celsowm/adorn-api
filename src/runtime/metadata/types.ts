/**
 * Runtime metadata types for adorn-api.
 * 
 * @remarks
 * This module contains the type definitions used by the runtime metadata
 * system, including HTTP methods, route operations, and authentication metadata.
 * 
 * @package
 */

/**
 * Supported HTTP methods for route operations.
 * 
 * @public
 */
export type HttpMethod = 
  | "GET" 
  | "POST" 
  | "PUT" 
  | "PATCH" 
  | "DELETE" 
  | "OPTIONS" 
  | "HEAD";

/**
 * Represents a single route operation registered on a controller.
 * 
 * @public
 */
export interface RouteOperation {
  /**
   * The HTTP method for this route.
   */
  httpMethod: HttpMethod;
  
  /**
   * The URL path pattern for this route (relative to controller base path).
   */
  path: string;
  
  /**
   * The name of the method on the controller class.
   */
  methodName: string;
  
  /**
   * Optional OpenAPI operation ID.
   */
  operationId?: string;
  
  /**
   * Array of middleware names or functions to apply to this route.
   */
  use?: Array<string | ExpressMw>;
  
  /**
   * Authentication configuration: "public" for open access, AuthMeta for protected.
   */
  auth?: AuthMeta | "public";
}

/**
 * Authentication metadata for a route.
 * 
 * @public
 */
export interface AuthMeta {
  /**
   * The authentication scheme name (e.g., "BearerAuth", "ApiKeyAuth").
   */
  scheme: string;
  
  /**
   * Required scopes for authorization. Empty array means any authenticated user.
   */
  scopes?: string[];
  
  /**
   * Whether authentication is optional for this route.
   */
  optional?: boolean;
}

/**
 * Type alias for Express middleware functions.
 * 
 * @public
 */
export type ExpressMw = (req: any, res: any, next: (err?: any) => void) => any;

/**
 * Container for all decorator metadata on a controller class.
 * 
 * @remarks
 * The AdornBucket is stored in class metadata and contains all route operations,
 * controller-level middleware, and base path configuration.
 * 
 * @public
 */
export interface AdornBucket {
  /**
   * Base path prefix for all routes in this controller.
   */
  basePath?: string;
  
  /**
   * Middleware to apply to all routes in this controller.
   */
  controllerUse?: Array<string | ExpressMw>;
  
  /**
   * Array of route operations defined on this controller.
   */
  ops: RouteOperation[];
}
