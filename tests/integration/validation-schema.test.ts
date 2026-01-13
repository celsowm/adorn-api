import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  Controller,
  Post,
  ExpressAdapter,
  ValidateBody,
  ValidateParams,
  type HttpContext,
  type ValidationSchema,
} from '../../src/index.js';
import { metadataStorage } from '../../src/metadata/metadata-storage.js';

const createUserSchema: ValidationSchema = {
  validate(value: any): boolean {
    return (
      typeof value.name === 'string' &&
      value.name.length > 0 &&
      typeof value.email === 'string' &&
      value.email.includes('@')
    );
  },
  getErrors(value: any): string[] {
    const errors: string[] = [];
    if (typeof value.name !== 'string' || value.name.length === 0) {
      errors.push('name is required');
    }
    if (typeof value.email !== 'string' || !value.email.includes('@')) {
      errors.push('email must be a valid email');
    }
    return errors;
  },
};

const idParamSchema: ValidationSchema = {
  validate(value: any): boolean {
    return typeof value.id === 'string' && /^\d+$/.test(value.id);
  },
  getErrors(value: any): string[] {
    if (typeof value.id !== 'string' || !/^\d+$/.test(value.id)) {
      return ['id must be a numeric string'];
    }
    return [];
  },
};

describe('Integration: Validation Schema', () => {
  let app: express.Application;

  beforeEach(() => {
    metadataStorage.reset();
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    app = null as any;
  });

  it('should pass validation with valid body', async () => {
    @Controller('/users')
    class UsersController {
      @Post('/')
      @ValidateBody(createUserSchema)
      create(ctx: HttpContext) {
        return { success: true, data: ctx.req.body };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(UsersController);

    const response = await request(app)
      .post('/users/')
      .send({ name: 'John', email: 'john@example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { name: 'John', email: 'john@example.com' },
    });
  });

  it('should fail validation with invalid body', async () => {
    @Controller('/users')
    class UsersController {
      @Post('/')
      @ValidateBody(createUserSchema)
      create(ctx: HttpContext) {
        return { success: true, data: ctx.req.body };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(UsersController);

    const response = await request(app)
      .post('/users/')
      .send({ name: '', email: 'invalid-email' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toContain('name is required');
    expect(response.body.errors).toContain('email must be a valid email');
  });

  it('should fail validation with missing fields', async () => {
    @Controller('/users')
    class UsersController {
      @Post('/')
      @ValidateBody(createUserSchema)
      create(ctx: HttpContext) {
        return { success: true };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(UsersController);

    const response = await request(app).post('/users/').send({});

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it('should validate params with valid id', async () => {
    @Controller('/users')
    class UsersController {
      @Post('/:id')
      @ValidateParams(idParamSchema)
      update(ctx: HttpContext) {
        return { id: ctx.params.param('id') };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(UsersController);

    const response = await request(app).post('/users/123').send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: '123' });
  });

  it('should fail validation with invalid param', async () => {
    @Controller('/users')
    class UsersController {
      @Post('/:id')
      @ValidateParams(idParamSchema)
      update(ctx: HttpContext) {
        return { id: ctx.params.param('id') };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(UsersController);

    const response = await request(app).post('/users/abc').send({});

    expect(response.status).toBe(400);
    expect(response.body.errors).toContain('id must be a numeric string');
  });

  it('should use default error message when getErrors is not provided', async () => {
    const simpleSchema: ValidationSchema = {
      validate: () => false,
    };

    @Controller('/simple')
    class SimpleController {
      @Post('/')
      @ValidateBody(simpleSchema)
      create() {
        return { success: true };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(SimpleController);

    const response = await request(app).post('/simple/').send({});

    expect(response.status).toBe(400);
    expect(response.body.errors).toContain('Validation failed');
  });

  it('should support async validation', async () => {
    const asyncSchema: ValidationSchema = {
      async validate(value: any): Promise<boolean> {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value.token === 'valid-token';
      },
      async getErrors(): Promise<string[]> {
        return ['Invalid token'];
      },
    };

    @Controller('/async')
    class AsyncController {
      @Post('/')
      @ValidateBody(asyncSchema)
      create() {
        return { success: true };
      }
    }

    const adapter = new ExpressAdapter(app);
    adapter.registerController(AsyncController);

    const validResponse = await request(app)
      .post('/async/')
      .send({ token: 'valid-token' });
    expect(validResponse.status).toBe(200);

    const invalidResponse = await request(app)
      .post('/async/')
      .send({ token: 'bad-token' });
    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.errors).toContain('Invalid token');
  });
});
