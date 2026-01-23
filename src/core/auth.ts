import type { Request, Response, NextFunction } from "express";
import type { Constructor } from "./types";
import { HttpError } from "./errors";

/**
 * User context interface - extend this in your application.
 */
export interface AuthUser {
  id: string;
  roles?: string[];
  [key: string]: unknown;
}

/**
 * Authentication options for a route or controller.
 */
export interface AuthOptions {
  /** Required roles (any match grants access) */
  roles?: string[];
  /** All roles required (all must match) */
  allRoles?: string[];
  /** Custom guard function */
  guard?: (user: AuthUser, req: Request) => boolean | Promise<boolean>;
}

/**
 * Function to extract user from request.
 */
export type AuthExtractor = (req: Request) => AuthUser | null | Promise<AuthUser | null>;

/**
 * Options for creating auth middleware.
 */
export interface AuthMiddlewareOptions {
  /** Function to extract user from request */
  extractor: AuthExtractor;
  /** Property name to attach user to request (default: "user") */
  userProperty?: string;
  /** Custom unauthorized response */
  onUnauthorized?: (req: Request, res: Response) => void;
  /** Custom forbidden response */
  onForbidden?: (req: Request, res: Response, reason?: string) => void;
}

/**
 * Metadata for authentication on routes/controllers.
 */
interface AuthMeta {
  /** Whether authentication is required */
  requiresAuth: boolean;
  /** Whether route is public (overrides controller-level auth) */
  isPublic: boolean;
  /** Required roles (any match) */
  roles?: string[];
  /** Required roles (all must match) */
  allRoles?: string[];
  /** Custom guard function */
  guard?: (user: AuthUser, req: Request) => boolean | Promise<boolean>;
}

const routeAuthStore = new Map<string, AuthMeta>();
const controllerAuthStore = new Map<Constructor, AuthMeta>();

function getRouteKey(controller: Constructor, handlerName: string | symbol): string {
  return `${controller.name}:${String(handlerName)}`;
}

/**
 * Decorator to require authentication on a controller or route.
 * @param options - Authentication options
 * @returns Decorator function
 */
export function Auth(options: AuthOptions = {}) {
  return function <T extends Constructor | ((...args: unknown[]) => unknown)>(
    target: T,
    context: ClassDecoratorContext | ClassMethodDecoratorContext
  ): void {
    const meta: AuthMeta = {
      requiresAuth: true,
      isPublic: false,
      roles: options.roles,
      allRoles: options.allRoles,
      guard: options.guard
    };

    if (context.kind === "class") {
      context.addInitializer(function () {
        controllerAuthStore.set(target as Constructor, meta);
      });
    } else if (context.kind === "method") {
      const handlerName = context.name;
      context.addInitializer(function () {
        const controller = (this as object).constructor as Constructor;
        routeAuthStore.set(getRouteKey(controller, handlerName), meta);
      });
    }
  };
}

/**
 * Decorator to require specific roles.
 * @param roles - Required roles (any match grants access)
 * @returns Method decorator function
 */
export function Roles(...roles: string[]) {
  return function (_target: unknown, context: ClassMethodDecoratorContext): void {
    const handlerName = context.name;
    context.addInitializer(function () {
      const controller = (this as object).constructor as Constructor;
      const key = getRouteKey(controller, handlerName);
      const existing = routeAuthStore.get(key) ?? {
        requiresAuth: true,
        isPublic: false
      };
      existing.roles = roles;
      existing.requiresAuth = true;
      routeAuthStore.set(key, existing);
    });
  };
}

/**
 * Decorator to require all specified roles.
 * @param roles - All roles required
 * @returns Method decorator function
 */
export function AllRoles(...roles: string[]) {
  return function (_target: unknown, context: ClassMethodDecoratorContext): void {
    const handlerName = context.name;
    context.addInitializer(function () {
      const controller = (this as object).constructor as Constructor;
      const key = getRouteKey(controller, handlerName);
      const existing = routeAuthStore.get(key) ?? {
        requiresAuth: true,
        isPublic: false
      };
      existing.allRoles = roles;
      existing.requiresAuth = true;
      routeAuthStore.set(key, existing);
    });
  };
}

/**
 * Decorator to mark a route as public (no authentication required).
 * Overrides controller-level @Auth decorator.
 * @returns Method decorator function
 */
export function Public() {
  return function (_target: unknown, context: ClassMethodDecoratorContext): void {
    const handlerName = context.name;
    context.addInitializer(function () {
      const controller = (this as object).constructor as Constructor;
      const key = getRouteKey(controller, handlerName);
      routeAuthStore.set(key, {
        requiresAuth: false,
        isPublic: true
      });
    });
  };
}

/**
 * Gets auth metadata for a specific route.
 * @param controller - Controller class
 * @param handlerName - Handler method name
 * @returns Combined auth metadata
 */
export function getRouteAuthMeta(
  controller: Constructor,
  handlerName: string | symbol
): AuthMeta | undefined {
  const routeMeta = routeAuthStore.get(getRouteKey(controller, handlerName));
  const controllerMeta = controllerAuthStore.get(controller);

  if (routeMeta?.isPublic) {
    return routeMeta;
  }

  if (routeMeta && controllerMeta) {
    return {
      requiresAuth: routeMeta.requiresAuth || controllerMeta.requiresAuth,
      isPublic: false,
      roles: routeMeta.roles ?? controllerMeta.roles,
      allRoles: routeMeta.allRoles ?? controllerMeta.allRoles,
      guard: routeMeta.guard ?? controllerMeta.guard
    };
  }

  return routeMeta ?? controllerMeta;
}

/**
 * Gets auth metadata for a controller.
 */
export function getControllerAuthMeta(controller: Constructor): AuthMeta | undefined {
  return controllerAuthStore.get(controller);
}

/**
 * Checks if user has any of the required roles.
 */
function hasAnyRole(user: AuthUser, roles: string[]): boolean {
  if (!roles.length) return true;
  if (!user.roles?.length) return false;
  return roles.some((role) => user.roles!.includes(role));
}

/**
 * Checks if user has all required roles.
 */
function hasAllRoles(user: AuthUser, roles: string[]): boolean {
  if (!roles.length) return true;
  if (!user.roles?.length) return false;
  return roles.every((role) => user.roles!.includes(role));
}

/**
 * Creates Express middleware for authentication.
 * Use this as a global middleware, then use route-level checks.
 * @param options - Auth middleware options
 * @returns Express middleware function
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
  const userProperty = options.userProperty ?? "user";

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await options.extractor(req);
      if (user) {
        (req as unknown as Record<string, unknown>)[userProperty] = user;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Creates a route guard middleware that checks auth metadata.
 * @param controller - Controller class
 * @param handlerName - Handler method name
 * @param options - Auth middleware options
 * @returns Express middleware function
 */
export function createRouteGuard(
  controller: Constructor,
  handlerName: string | symbol,
  options: { userProperty?: string } = {}
) {
  const userProperty = options.userProperty ?? "user";
  const authMeta = getRouteAuthMeta(controller, handlerName);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!authMeta || authMeta.isPublic || !authMeta.requiresAuth) {
      next();
      return;
    }

    const user = (req as unknown as Record<string, unknown>)[userProperty] as AuthUser | undefined;

    if (!user) {
      throw new HttpError(401, "Unauthorized");
    }

    if (authMeta.roles?.length && !hasAnyRole(user, authMeta.roles)) {
      throw new HttpError(403, "Insufficient permissions");
    }

    if (authMeta.allRoles?.length && !hasAllRoles(user, authMeta.allRoles)) {
      throw new HttpError(403, "Insufficient permissions");
    }

    if (authMeta.guard) {
      const allowed = await authMeta.guard(user, req);
      if (!allowed) {
        throw new HttpError(403, "Access denied by guard");
      }
    }

    next();
  };
}

/**
 * Helper to get user from request in controllers.
 * @param req - Express request
 * @param userProperty - Property name (default: "user")
 * @returns User or undefined
 */
export function getUser<T extends AuthUser = AuthUser>(
  req: Request,
  userProperty: string = "user"
): T | undefined {
  return (req as unknown as Record<string, unknown>)[userProperty] as T | undefined;
}

/**
 * Helper to require user from request (throws if not present).
 * @param req - Express request
 * @param userProperty - Property name (default: "user")
 * @returns User
 * @throws HttpError if user not found
 */
export function requireUser<T extends AuthUser = AuthUser>(
  req: Request,
  userProperty: string = "user"
): T {
  const user = getUser<T>(req, userProperty);
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }
  return user;
}
