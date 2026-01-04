import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest, CreateRouterOptions, OpenAPI31 } from "./types.js";
import type { BoundRoute } from "./merge.js";

export function createAuthMiddleware(
    authConfig: NonNullable<CreateRouterOptions["auth"]>,
    routeAuth: BoundRoute["auth"],
    globalSecurity: NonNullable<OpenAPI31["security"]>
) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const isPublic = routeAuth === "public";
        const hasAuthDecorator = routeAuth && routeAuth !== "public";
        const hasGlobalSecurity = globalSecurity && globalSecurity.length > 0;

        if (!hasAuthDecorator && !hasGlobalSecurity) {
            return next();
        }

        if (isPublic) {
            return next();
        }

        const authMeta = routeAuth as { scheme: string; scopes?: string[]; optional?: boolean };
        const scheme = authMeta.scheme;
        const requiredScopes = authMeta.scopes || [];
        const isOptional = authMeta.optional ?? false;

        const authRuntime = authConfig.schemes[scheme];
        if (!authRuntime) {
            throw new Error(`Auth scheme "${scheme}" not found in auth configuration`);
        }

        const result = await authRuntime.authenticate(req);

        if (!result) {
            if (isOptional) {
                req.auth = null;
                return next();
            }
            return authRuntime.challenge(res);
        }

        req.auth = result.principal;

        if (authRuntime.authorize && requiredScopes.length > 0) {
            if (!authRuntime.authorize(result, requiredScopes)) {
                res.status(403).json({ error: "Forbidden", message: "Insufficient scopes" });
                return;
            }
        }

        next();
    };
}
