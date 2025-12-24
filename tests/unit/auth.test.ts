import { describe, it, expect } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  AuthGuard,
  RolesGuard,
  PermissionsGuard,
  CombineGuards,
  applyGuards,
  UnauthorizedError,
  ForbiddenError,
  AuthenticationError,
} from '../../src/decorators/auth.js';

describe('Auth Decorators', () => {
  describe('AuthGuard', () => {
    it('should call next with UnauthorizedError when Authorization header is missing', () => {
      const guard = AuthGuard();
      const req = { headers: {} } as Request;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeInstanceOf(UnauthorizedError);
      expect((capturedError as UnauthorizedError).message).toBe('Missing authorization header');
    });

    it('should call next with UnauthorizedError when Authorization format is invalid', () => {
      const guard = AuthGuard();
      const req = { headers: { authorization: 'InvalidFormat token123' } } as Request;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeInstanceOf(UnauthorizedError);
      expect((capturedError as UnauthorizedError).message).toBe('Invalid authorization format');
    });

    it('should call next with UnauthorizedError when token is empty after prefix', () => {
      const guard = AuthGuard();
      const req = { headers: { authorization: 'Bearer' } } as Request;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeInstanceOf(UnauthorizedError);
    });

    it('should set user on request and call next when token is valid', () => {
      const guard = AuthGuard();
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const req = { headers: { authorization: `Bearer ${token}` } } as any;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeUndefined();
      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('1234567890');
    });

    it('should accept custom header name', () => {
      const guard = AuthGuard({ header: 'X-Auth-Token' });
      const req = { headers: {} } as Request;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeInstanceOf(UnauthorizedError);
    });

    it('should accept custom prefix', () => {
      const guard = AuthGuard({ prefix: 'API' });
      const req = { headers: { authorization: 'API token123' } } as Request;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeUndefined();
    });
  });

  describe('RolesGuard', () => {
    it('should call next with UnauthorizedError when user is not set', () => {
      const guard = RolesGuard('admin');
      const req = { user: undefined } as any;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeInstanceOf(UnauthorizedError);
      expect((capturedError as UnauthorizedError).message).toBe('Not authenticated');
    });

    it('should call next with ForbiddenError when user lacks required role', () => {
      const guard = RolesGuard('admin');
      const req = { user: { roles: ['user'] } } as any;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeInstanceOf(ForbiddenError);
      expect((capturedError as ForbiddenError).message).toBe('Insufficient role');
    });

    it('should call next without error when user has required role', () => {
      const guard = RolesGuard('admin');
      const req = { user: { roles: ['admin', 'user'] } } as any;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeUndefined();
    });

    it('should accept multiple roles and pass if user has any', () => {
      const guard = RolesGuard('admin', 'moderator');
      const req = { user: { roles: ['moderator'] } } as any;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeUndefined();
    });
  });

  describe('PermissionsGuard', () => {
    it('should call next with UnauthorizedError when user is not set', () => {
      const guard = PermissionsGuard('read:users');
      const req = { user: undefined } as any;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeInstanceOf(UnauthorizedError);
    });

    it('should call next with ForbiddenError when user lacks permission', () => {
      const guard = PermissionsGuard('write:users');
      const req = { user: { permissions: ['read:users'] } } as any;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeInstanceOf(ForbiddenError);
      expect((capturedError as ForbiddenError).message).toBe('Insufficient permissions');
    });

    it('should call next without error when user has all required permissions', () => {
      const guard = PermissionsGuard('read:users', 'write:users');
      const req = { user: { permissions: ['read:users', 'write:users', 'delete:users'] } } as any;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeUndefined();
    });

    it('should require all permissions, not just one', () => {
      const guard = PermissionsGuard('read:users', 'write:users');
      const req = { user: { permissions: ['read:users'] } } as any;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      guard(req, {} as Response, next);

      expect(capturedError).toBeInstanceOf(ForbiddenError);
    });
  });

  describe('CombineGuards', () => {
    it('should run guards sequentially - guards are called', async () => {
      const calls: string[] = [];
      
      const guard1 = (_req: Request, _res: Response, next: NextFunction) => {
        calls.push('guard1');
        next();
      };
      
      const guard2 = (_req: Request, _res: Response, next: NextFunction) => {
        calls.push('guard2');
        next();
      };

      const combined = CombineGuards(guard1, guard2);
      const req = {} as Request;
      
      await new Promise<void>((resolve) => {
        combined(req, {} as Response, () => {
          resolve();
        });
      });

      expect(calls).toEqual(['guard1', 'guard2']);
    });
  });

  describe('applyGuards', () => {
    it('should apply multiple guards in sequence', async () => {
      const calls: string[] = [];
      
      const guard1 = (_req: Request, _res: Response, next: NextFunction) => {
        calls.push('guard1');
        next();
      };
      
      const guard2 = (_req: Request, _res: Response, next: NextFunction) => {
        calls.push('guard2');
        next();
      };

      const req = {} as Request;

      applyGuards(req, {} as Response, () => {}, [guard1, guard2]);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(calls).toEqual(['guard1', 'guard2']);
    });

    it('should stop on first error', async () => {
      const calls: string[] = [];
      
      const guard1 = (_req: Request, _res: Response, next: NextFunction) => {
        calls.push('guard1');
        next(new Error('Stop here'));
      };
      
      const guard2 = (_req: Request, _res: Response, next: NextFunction) => {
        calls.push('guard2');
        next();
      };

      const req = {} as Request;
      let capturedError: unknown;
      const next: NextFunction = (err?: unknown) => { capturedError = err; };

      applyGuards(req, {} as Response, next, [guard1, guard2]);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(calls).toEqual(['guard1']);
      expect(capturedError).not.toBeUndefined();
    });
  });

  describe('Error classes', () => {
    it('should create UnauthorizedError with custom message', () => {
      const error = new UnauthorizedError('Custom message');
      expect(error.name).toBe('UnauthorizedError');
      expect(error.message).toBe('Custom message');
    });

    it('should create ForbiddenError with custom message', () => {
      const error = new ForbiddenError('Custom forbidden');
      expect(error.name).toBe('ForbiddenError');
      expect(error.message).toBe('Custom forbidden');
    });

    it('should create AuthenticationError', () => {
      const error = new AuthenticationError('Auth failed');
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Auth failed');
    });
  });
});
