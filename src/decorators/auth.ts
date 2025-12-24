/**
 * Authentication decorators for adorn-api
 * 
 * Provides decorators for route protection, guards, and authentication.
 */

import type { Request, Response, NextFunction } from 'express';
import '../polyfills/symbol-metadata.js';
import { SECURITY_KEY } from '../meta/keys.js';

/**
 * Type guard function
 */
export type GuardFn = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

/**
 * Create an authentication guard
 * 
 * Usage:
 *   @UseGuards(AuthGuard())
 *   @Get('/protected')
 *   protectedRoute() { ... }
 */
export function AuthGuard(_options: {
  /** Header name to check (default: Authorization) */
  header?: string;
  /** Prefix for the token (default: Bearer) */
  prefix?: string;
  /** Function to extract user from request */
  getUser?: (req: Request) => any;
} = {}) {
  const {
    header = 'Authorization',
    prefix = 'Bearer',
  } = _options;

  function guard(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers[header.toLowerCase()];
    
    if (!authHeader) {
      return next(new UnauthorizedError('Missing authorization header'));
    }
    
    if (typeof authHeader !== 'string' || !authHeader.startsWith(prefix + ' ')) {
      return next(new UnauthorizedError('Invalid authorization format'));
    }
    
    const token = authHeader.slice(prefix.length + 1);
    
    if (!token) {
      return next(new UnauthorizedError('Missing token'));
    }
    
    try {
      // Decode/verify token here (JWT, etc.)
      const user = decodeToken(token);
      (req as any).user = user;
      next();
    } catch {
      next(new UnauthorizedError('Invalid token'));
    }
  }

  return guard;
}

/**
 * Apply guards as a decorator
 */
export function UseGuards(...guards: GuardFn[]) {
  return function (
    _target: object,
    context?: ClassMethodDecoratorContext
  ): void {
    if (context?.metadata) {
      if (!context.metadata[SECURITY_KEY]) {
        context.metadata[SECURITY_KEY] = new Map<string | symbol, GuardFn[]>();
      }
      (context.metadata[SECURITY_KEY] as Map<string | symbol, GuardFn[]>).set(context.name, guards);
    }
  };
}

/**
 * Create a roles guard
 * 
 * Usage:
 *   @UseGuards(RolesGuard('admin'))
 *   @Get('/admin')
 *   adminRoute() { ... }
 */
export function RolesGuard(...requiredRoles: string[]) {
  function guard(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;
    
    if (!user) {
      return next(new UnauthorizedError('Not authenticated'));
    }
    
    const userRoles = user.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return next(new ForbiddenError('Insufficient role'));
    }
    
    next();
  }

  return guard;
}

/**
 * Create a permissions guard
 * 
 * Usage:
 *   @UseGuards(PermissionsGuard('read:users', 'write:users'))
 *   @Get('/users')
 *   usersRoute() { ... }
 */
export function PermissionsGuard(...requiredPermissions: string[]) {
  function guard(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;
    
    if (!user) {
      return next(new UnauthorizedError('Not authenticated'));
    }
    
    const userPermissions = user.permissions || [];
    const hasAllPermissions = requiredPermissions.every(perm => 
      userPermissions.includes(perm)
    );
    
    if (!hasAllPermissions) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    
    next();
  }

  return guard;
}

/**
 * Combine multiple guards sequentially
 */
export function CombineGuards(...guards: GuardFn[]) {
  return function combined(req: Request, _res: Response, next: NextFunction) {
    let index = 0;
    
    function runNext(err?: unknown): void {
      if (err) {
        return next(err as Error);
      }
      
      if (index >= guards.length) {
        return next();
      }
      
      const guard = guards[index];
      index++;
      
      if (guard) {
        Promise.resolve(guard(req, {} as Response, runNext)).catch((e) => next(e));
      } else {
        runNext();
      }
    }
    
    runNext();
  };
}

/**
 * Apply guards to a route
 */
export function applyGuards(
  req: Request,
  res: Response,
  next: NextFunction,
  guards: GuardFn[]
): void {
  let index = 0;
  
  function runNext(err?: unknown): void {
    if (err) {
      return next(err as Error);
    }
    
    if (index >= guards.length) {
      return next();
    }
    
    const guard = guards[index];
    index++;
    
    if (guard) {
      Promise.resolve(guard(req, res, runNext)).catch((e) => next(e));
    } else {
      runNext();
    }
  }
  
  runNext();
}

// Helper functions (implement with actual JWT/library)
function decodeToken(token: string): any {
  // Simple base64 decode for demo (use actual JWT in production)
  try {
    const parts = token.split('.');
    if (parts.length === 3 && parts[1]) {
      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      return JSON.parse(payload);
    }
  } catch {
    // Not a JWT, treat as opaque token
    return { token };
  }
  return { token };
}

/**
 * Error classes for authentication
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
