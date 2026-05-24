import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import {
  Auth,
  Roles,
  AllRoles,
  Public,
  getRouteAuthMeta,
  getControllerAuthMeta,
  createAuthMiddleware,
  createBearerAuthMiddleware,
  createRouteGuard,
  extractBearerToken,
  getUser,
  requireUser,
  type AuthUser
} from "../../src/core/auth";
import { Controller } from "../../src/core/decorators";
import { HttpError } from "../../src/core/errors";

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides
  } as Request;
}

function createMockResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  } as unknown as Response;
}

describe("@Auth decorator", () => {
  it("marks controller as requiring auth", () => {
    @Auth()
    @Controller("/users")
    class UserController {
      list() {}
    }

    new UserController();
    const meta = getControllerAuthMeta(UserController);
    expect(meta?.requiresAuth).toBe(true);
  });

  it("marks route as requiring auth", () => {
    @Controller("/users")
    class UserController {
      @Auth()
      secret() {}
    }

    new UserController();
    const meta = getRouteAuthMeta(UserController, "secret");
    expect(meta?.requiresAuth).toBe(true);
  });

  it("stores roles from options", () => {
    @Controller("/admin")
    class AdminController {
      @Auth({ roles: ["admin", "superadmin"] })
      dashboard() {}
    }

    new AdminController();
    const meta = getRouteAuthMeta(AdminController, "dashboard");
    expect(meta?.roles).toEqual(["admin", "superadmin"]);
  });

  it("stores allRoles from options", () => {
    @Controller("/admin")
    class AdminController {
      @Auth({ allRoles: ["admin", "verified"] })
      sensitive() {}
    }

    new AdminController();
    const meta = getRouteAuthMeta(AdminController, "sensitive");
    expect(meta?.allRoles).toEqual(["admin", "verified"]);
  });

  it("stores custom guard from options", () => {
    const customGuard = (user: AuthUser) => user.id === "123";

    @Controller("/users")
    class UserController {
      @Auth({ guard: customGuard })
      profile() {}
    }

    new UserController();
    const meta = getRouteAuthMeta(UserController, "profile");
    expect(meta?.guard).toBe(customGuard);
  });
});

describe("@Roles decorator", () => {
  it("sets required roles on route", () => {
    @Controller("/admin")
    class AdminController {
      @Roles("admin", "moderator")
      manage() {}
    }

    new AdminController();
    const meta = getRouteAuthMeta(AdminController, "manage");
    expect(meta?.roles).toEqual(["admin", "moderator"]);
    expect(meta?.requiresAuth).toBe(true);
  });
});

describe("@AllRoles decorator", () => {
  it("sets all required roles on route", () => {
    @Controller("/admin")
    class AdminController {
      @AllRoles("admin", "verified", "2fa")
      superSecure() {}
    }

    new AdminController();
    const meta = getRouteAuthMeta(AdminController, "superSecure");
    expect(meta?.allRoles).toEqual(["admin", "verified", "2fa"]);
    expect(meta?.requiresAuth).toBe(true);
  });
});

describe("@Public decorator", () => {
  it("marks route as public", () => {
    @Auth()
    @Controller("/api")
    class ApiController {
      @Public()
      health() {}

      protected() {}
    }

    new ApiController();
    const publicMeta = getRouteAuthMeta(ApiController, "health");
    expect(publicMeta?.isPublic).toBe(true);
    expect(publicMeta?.requiresAuth).toBe(false);
  });

  it("overrides controller-level auth", () => {
    @Auth({ roles: ["admin"] })
    @Controller("/admin")
    class AdminController {
      @Public()
      login() {}
    }

    new AdminController();
    const meta = getRouteAuthMeta(AdminController, "login");
    expect(meta?.isPublic).toBe(true);
  });
});

describe("getRouteAuthMeta", () => {
  it("merges route and controller meta", () => {
    @Auth({ roles: ["user"] })
    @Controller("/api")
    class ApiController {
      @Roles("admin")
      adminOnly() {}

      regularRoute() {}
    }

    new ApiController();

    const adminMeta = getRouteAuthMeta(ApiController, "adminOnly");
    expect(adminMeta?.roles).toEqual(["admin"]);

    const regularMeta = getRouteAuthMeta(ApiController, "regularRoute");
    expect(regularMeta?.roles).toEqual(["user"]);
  });
});

describe("createAuthMiddleware", () => {
  it("extracts user and attaches to request", async () => {
    const user: AuthUser = { id: "123", roles: ["user"] };
    const middleware = createAuthMiddleware({
      extractor: () => user
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect((req as unknown as Record<string, unknown>).user).toBe(user);
    expect(next).toHaveBeenCalled();
  });

  it("uses custom user property", async () => {
    const user: AuthUser = { id: "123" };
    const middleware = createAuthMiddleware({
      extractor: () => user,
      userProperty: "currentUser"
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect((req as unknown as Record<string, unknown>).currentUser).toBe(user);
  });

  it("handles null user gracefully", async () => {
    const middleware = createAuthMiddleware({
      extractor: () => null
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect((req as unknown as Record<string, unknown>).user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("handles async extractor", async () => {
    const user: AuthUser = { id: "async-user" };
    const middleware = createAuthMiddleware({
      extractor: async () => user
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect((req as unknown as Record<string, unknown>).user).toBe(user);
  });
});

describe("extractBearerToken", () => {
  it("returns undefined when authorization header is missing", () => {
    expect(extractBearerToken(createMockRequest())).toBeUndefined();
  });

  it("extracts token from Bearer authorization header", () => {
    const req = createMockRequest({ headers: { authorization: "Bearer abc123" } });
    expect(extractBearerToken(req)).toBe("abc123");
  });

  it("extracts token from case-insensitive bearer scheme", () => {
    const req = createMockRequest({ headers: { authorization: "bearer abc123" } });
    expect(extractBearerToken(req)).toBe("abc123");
  });

  it("returns undefined for invalid authorization formats", () => {
    expect(extractBearerToken(createMockRequest({ headers: { authorization: "Basic abc123" } }))).toBeUndefined();
    expect(extractBearerToken(createMockRequest({ headers: { authorization: "Bearer" } }))).toBeUndefined();
    expect(extractBearerToken(createMockRequest({ headers: { authorization: "Bearer abc def" } }))).toBeUndefined();
  });
});

describe("createBearerAuthMiddleware", () => {
  it("attaches user for a valid bearer token", async () => {
    const user: AuthUser = { id: "bearer-user", roles: ["user"] };
    const middleware = createBearerAuthMiddleware({
      verifyToken: vi.fn().mockResolvedValue(user)
    });
    const req = createMockRequest({ headers: { authorization: "Bearer valid" } });
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect((req as unknown as Record<string, unknown>).user).toBe(user);
    expect(next).toHaveBeenCalledWith();
  });

  it("does not attach user for an invalid bearer token", async () => {
    const middleware = createBearerAuthMiddleware({
      verifyToken: vi.fn().mockResolvedValue(null)
    });
    const req = createMockRequest({ headers: { authorization: "Bearer invalid" } });
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect((req as unknown as Record<string, unknown>).user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it("passes verifier errors to next", async () => {
    const error = new Error("verifier failed");
    const middleware = createBearerAuthMiddleware({
      verifyToken: vi.fn().mockRejectedValue(error)
    });
    const req = createMockRequest({ headers: { authorization: "Bearer bad" } });
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("uses custom user property", async () => {
    const user: AuthUser = { id: "custom" };
    const middleware = createBearerAuthMiddleware({
      userProperty: "currentUser",
      verifyToken: vi.fn().mockResolvedValue(user)
    });
    const req = createMockRequest({ headers: { authorization: "Bearer valid" } });
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect((req as unknown as Record<string, unknown>).currentUser).toBe(user);
  });
});

describe("createRouteGuard", () => {
  it("allows public routes without user", async () => {
    @Controller("/api")
    class ApiController {
      @Public()
      health() {}
    }

    new ApiController();
    const guard = createRouteGuard(ApiController, "health");

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await guard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("throws 401 for protected route without user", async () => {
    @Controller("/api")
    class ApiController {
      @Auth()
      protected() {}
    }

    new ApiController();
    const guard = createRouteGuard(ApiController, "protected");

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await expect(guard(req, res, next)).rejects.toThrow(HttpError);
  });

  it("allows user with correct role", async () => {
    @Controller("/admin")
    class AdminController {
      @Roles("admin")
      dashboard() {}
    }

    new AdminController();
    const guard = createRouteGuard(AdminController, "dashboard");

    const req = createMockRequest();
    (req as unknown as Record<string, unknown>).user = { id: "1", roles: ["admin"] };
    const res = createMockResponse();
    const next = vi.fn();

    await guard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("throws 403 for user without required role", async () => {
    @Controller("/admin")
    class AdminController {
      @Roles("admin")
      dashboard() {}
    }

    new AdminController();
    const guard = createRouteGuard(AdminController, "dashboard");

    const req = createMockRequest();
    (req as unknown as Record<string, unknown>).user = { id: "1", roles: ["user"] };
    const res = createMockResponse();
    const next = vi.fn();

    await expect(guard(req, res, next)).rejects.toThrow(HttpError);
  });

  it("checks allRoles requirement", async () => {
    @Controller("/admin")
    class AdminController {
      @AllRoles("admin", "verified")
      superSecure() {}
    }

    new AdminController();
    const guard = createRouteGuard(AdminController, "superSecure");

    const req = createMockRequest();
    (req as unknown as Record<string, unknown>).user = { id: "1", roles: ["admin"] };
    const res = createMockResponse();
    const next = vi.fn();

    await expect(guard(req, res, next)).rejects.toThrow(HttpError);

    (req as unknown as Record<string, unknown>).user = { id: "1", roles: ["admin", "verified"] };
    await guard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("executes custom guard", async () => {
    const customGuard = vi.fn().mockReturnValue(true);

    @Controller("/users")
    class UserController {
      @Auth({ guard: customGuard })
      profile() {}
    }

    new UserController();
    const guard = createRouteGuard(UserController, "profile");

    const req = createMockRequest();
    const user: AuthUser = { id: "123" };
    (req as unknown as Record<string, unknown>).user = user;
    const res = createMockResponse();
    const next = vi.fn();

    await guard(req, res, next);

    expect(customGuard).toHaveBeenCalledWith(user, req);
    expect(next).toHaveBeenCalled();
  });

  it("throws 403 when custom guard returns false", async () => {
    @Controller("/users")
    class UserController {
      @Auth({ guard: () => false })
      profile() {}
    }

    new UserController();
    const guard = createRouteGuard(UserController, "profile");

    const req = createMockRequest();
    (req as unknown as Record<string, unknown>).user = { id: "123" };
    const res = createMockResponse();
    const next = vi.fn();

    await expect(guard(req, res, next)).rejects.toThrow(HttpError);
  });
});

describe("getUser helper", () => {
  it("returns user from request", () => {
    const req = createMockRequest();
    const user: AuthUser = { id: "123" };
    (req as unknown as Record<string, unknown>).user = user;

    expect(getUser(req)).toBe(user);
  });

  it("returns undefined when no user", () => {
    const req = createMockRequest();
    expect(getUser(req)).toBeUndefined();
  });

  it("uses custom property name", () => {
    const req = createMockRequest();
    const user: AuthUser = { id: "123" };
    (req as unknown as Record<string, unknown>).currentUser = user;

    expect(getUser(req, "currentUser")).toBe(user);
  });
});

describe("requireUser helper", () => {
  it("returns user when present", () => {
    const req = createMockRequest();
    const user: AuthUser = { id: "123" };
    (req as unknown as Record<string, unknown>).user = user;

    expect(requireUser(req)).toBe(user);
  });

  it("throws HttpError when no user", () => {
    const req = createMockRequest();
    expect(() => requireUser(req)).toThrow(HttpError);
  });
});
