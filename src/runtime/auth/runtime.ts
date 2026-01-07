/**
 * Runtime authentication module for adorn-api.
 * 
 * @remarks
 * This module provides interfaces and factory functions for implementing
 * authentication schemes in adorn-api. It includes utilities for Bearer JWT
 * authentication and API key authentication.
 * 
 * @package
 */

/**
 * Result of an authentication attempt.
 * 
 * @remarks
 * Contains the authenticated principal (user/entity) and any granted scopes
 * that can be used for authorization decisions.
 * 
 * @public
 */
export interface AuthResult {
  /**
   * The authenticated principal (user object, token payload, etc.).
   */
  principal: any;
  
  /**
   * Array of scope strings granted to the principal.
   * Used for authorization checks.
   */
  scopes?: string[];
}

/**
 * Runtime interface for an authentication scheme.
 * 
 * @remarks
 * Implement this interface to create custom authentication schemes.
 * Each scheme must provide methods for authentication, issuing challenges,
 * and optional authorization.
 * 
 * @public
 */
export interface AuthSchemeRuntime {
  /**
   * Unique name identifying this authentication scheme.
   */
  name: string;
  
  /**
   * Authenticate a request and return the result.
   * 
   * @param req - The incoming request object
   * @returns Promise resolving to AuthResult if authenticated, null otherwise
   */
  authenticate(req: any): Promise<AuthResult | null>;
  
  /**
   * Send an authentication challenge to the client.
   * 
   * @param res - The response object to send the challenge
   */
  challenge(res: any): void;
  
  /**
   * Authorize an authenticated principal against required scopes.
   * 
   * @param auth - The authentication result
   * @param requiredScopes - Scopes required for the operation
   * @returns true if authorized, false otherwise
   */
  authorize?(auth: AuthResult, requiredScopes: string[]): boolean;
}

/**
 * Options for creating a Bearer JWT authentication runtime.
 * 
 * @public
 */
export interface BearerJwtRuntimeOptions {
  /**
   * Extract the Bearer token from a request.
   * 
   * @param req - The incoming request object
   * @returns The token string, or undefined if not present
   */
  getToken: (req: any) => string | undefined;
  
  /**
   * Verify a JWT token and return its payload.
   * 
   * @param token - The JWT token to verify
   * @returns Promise resolving to the token payload
   * @defaultvalue Async function that returns the token as payload
   */
  verify?: (token: string) => Promise<any>;
  
  /**
   * Extract scopes from a token payload.
   * 
   * @param payload - The JWT payload
   * @returns Array of scope strings
   * @defaultvalue Function returning empty array
   */
  getScopes?: (payload: any) => string[];
}

/**
 * Options for creating an API key header authentication runtime.
 * 
 * @public
 */
export interface ApiKeyHeaderRuntimeOptions {
  /**
   * The name of the header containing the API key.
   */
  headerName: string;
  
  /**
   * Validate an API key and return the associated principal.
   * 
   * @param key - The API key to validate
   * @returns Promise resolving to the principal (user/service) associated with the key
   */
  validate: (key: string) => Promise<any>;
}

/**
 * Creates a Bearer JWT authentication runtime.
 * 
 * @remarks
 * This factory function creates an AuthSchemeRuntime for Bearer token authentication.
 * The implementation extracts the token from the Authorization header, verifies it,
 * and extracts scopes from the payload.
 * 
 * @example
 * ```typescript
 * const bearerRuntime = createBearerJwtRuntime({
 *   getToken: (req) => req.headers.authorization?.split(' ')[1],
 *   verify: async (token) => jwt.verify(token, secret),
 *   getScopes: (payload) => payload.scopes || []
 * });
 * ```
 * 
 * @param options - Configuration options for the Bearer JWT runtime
 * @returns An AuthSchemeRuntime for Bearer authentication
 * 
 * @public
 */
export function createBearerJwtRuntime(options: BearerJwtRuntimeOptions) {
  const { getToken, verify = async (token: string) => ({ token }), getScopes = () => [] } = options;

  return {
    name: "BearerAuth",
    
    /** @inheritdoc */
    async authenticate(req: any) {
      const token = getToken(req);
      if (!token) return null;

      try {
        const payload = await verify(token);
        const scopes = getScopes(payload);
        return { principal: payload, scopes };
      } catch {
        return null;
      }
    },
    
    /** @inheritdoc */
    challenge(res: any) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="access"');
      res.status(401).json({ error: "Unauthorized", message: "Missing or invalid Bearer token" });
    },
    
    /** @inheritdoc */
    authorize(auth: AuthResult, requiredScopes: string[]) {
      if (requiredScopes.length === 0) return true;
      const userScopes = auth.scopes || [];
      return requiredScopes.every(scope => userScopes.includes(scope));
    },
  };
}

/**
 * Creates an API key header authentication runtime.
 * 
 * @remarks
 * This factory function creates an AuthSchemeRuntime for API key authentication.
 * The implementation extracts the API key from a specified header and validates it.
 * 
 * @example
 * ```typescript
 * const apiKeyRuntime = createApiKeyHeaderRuntime({
 *   headerName: "X-API-Key",
 *   validate: async (key) => {
 *     const user = await db.users.findByApiKey(key);
 *     if (!user) throw new Error("Invalid API key");
 *     return user;
 *   }
 * });
 * ```
 * 
 * @param options - Configuration options for the API key runtime
 * @returns An AuthSchemeRuntime for API key authentication
 * 
 * @public
 */
export function createApiKeyHeaderRuntime(options: ApiKeyHeaderRuntimeOptions) {
  const { headerName, validate } = options;

  return {
    name: "ApiKeyAuth",
    
    /** @inheritdoc */
    async authenticate(req: any) {
      const key = req.headers[headerName.toLowerCase()];
      if (!key) return null;

      try {
        const principal = await validate(key);
        return { principal };
      } catch {
        return null;
      }
    },
    
    /** @inheritdoc */
    challenge(res: any) {
      res.status(401).json({ error: "Unauthorized", message: `Missing or invalid ${headerName}` });
    },
  };
}
