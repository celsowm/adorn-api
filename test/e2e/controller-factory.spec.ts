import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdornExpressApp } from '../../src/express.js';
import { Bindings, Controller, Get } from '../../src/decorators/index.js';
import type { Request, Response } from 'express';

// A simple service that we want to inject into controllers
class UserService {
  private users = new Map<number, string>([
    [1, 'Alice'],
    [2, 'Bob'],
    [3, 'Charlie'],
  ]);

  getUserName(id: number): string | undefined {
    return this.users.get(id);
  }

  getAllUsers(): Map<number, string> {
    return this.users;
  }
}

// Another service for audit logging
class AuditService {
  log(action: string, userId: number, details?: any): void {
    console.log(`[AUDIT] ${action} for user ${userId}`, details);
  }
}

@Controller('/users')
class UsersController {
  // These will be injected by the factory
  private userService: UserService;
  private auditService: AuditService;

  constructor(userService: UserService, auditService: AuditService) {
    this.userService = userService;
    this.auditService = auditService;
  }

  @Bindings({ path: { id: 'int' } })
  @Get('/{id}')
  getUser(id: number): { id: number; name: string; found: boolean } {
    // Use the injected service
    const name = this.userService.getUserName(id);
    
    // Log the action
    this.auditService.log('GET_USER', id, { found: !!name });
    
    return {
      id,
      name: name || 'Unknown',
      found: !!name,
    };
  }

  @Get('/')
  getAllUsers(): Array<{ id: number; name: string }> {
    const users = this.userService.getAllUsers();
    this.auditService.log('GET_ALL_USERS', 0);
    
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
  }
}

@Controller('/admin')
class AdminController {
  private auditService: AuditService;

  constructor(auditService: AuditService) {
    this.auditService = auditService;
  }

  @Get('/audit-log')
  getAuditInfo(): { message: string; timestamp: string } {
    this.auditService.log('ADMIN_ACCESS', 0, { endpoint: '/admin/audit-log' });
    
    return {
      message: 'Audit service is active',
      timestamp: new Date().toISOString(),
    };
  }
}

describe('Controller Factory', () => {
  // Create shared services
  const userService = new UserService();
  const auditService = new AuditService();

  // Custom controller factory that injects dependencies
  const controllerFactory = (ctor: any, req: Request, res: Response) => {
    // Based on the controller type, inject the appropriate dependencies
    if (ctor === UsersController) {
      return new UsersController(userService, auditService);
    } else if (ctor === AdminController) {
      return new AdminController(auditService);
    }
    
    // Fallback for unknown controllers
    return new ctor();
  };

  // Create app with custom controller factory
  const app = createAdornExpressApp({
    controllers: [UsersController, AdminController],
    controllerFactory,
  });

  describe('GET /users/{id}', () => {
    it('returns user with injected service', async () => {
      const res = await request(app).get('/users/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 1, name: 'Alice', found: true });
    });

    it('returns unknown user for non-existent id', async () => {
      const res = await request(app).get('/users/999');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 999, name: 'Unknown', found: false });
    });
  });

  describe('GET /users', () => {
    it('returns all users from injected service', async () => {
      const res = await request(app).get('/users');

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body).toContainEqual({ id: 1, name: 'Alice' });
      expect(res.body).toContainEqual({ id: 2, name: 'Bob' });
      expect(res.body).toContainEqual({ id: 3, name: 'Charlie' });
    });
  });

  describe('GET /admin/audit-log', () => {
    it('uses controller with different dependency injection', async () => {
      const res = await request(app).get('/admin/audit-log');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body.message).toBe('Audit service is active');
    });
  });
});
