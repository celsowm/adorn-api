import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'sqlite3';
import { Orm, SqliteDialect, createSqliteExecutor, Entity, Column, PrimaryKey, col, bootstrapEntities, selectFromEntity, eq, entityRef, deleteFrom } from 'metal-orm';
import { ExpressAdapter, Controller, Get, Post, Put, Delete, Body, Params, Schema } from '../../src/index.js';
import { z } from 'zod';

// Define the User entity
@Entity()
class User {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @Column(col.varchar(255))
  email!: string;

  @Column(col.default(col.boolean(), false))
  active!: boolean;
}

// Define the UserService
class UserService {
  constructor(private session: any) {}

  async getAll(): Promise<User[]> {
    const users = await selectFromEntity(User)
      .select('id', 'name', 'email', 'active')
      .execute(this.session);
    return users;
  }

  async getById(id: number): Promise<User | null> {
    const users = await selectFromEntity(User)
      .select('id', 'name', 'email', 'active')
      .where(eq(entityRef(User).id, id))
      .execute(this.session);
    return users[0] || null;
  }

  async create(data: { name: string; email: string; active?: boolean }): Promise<User> {
    const user = new User();
    user.name = data.name;
    user.email = data.email;
    user.active = data.active ?? false;
    await this.session.persist(user);
    await this.session.commit();
    return user;
  }

  async update(id: number, data: Partial<{ name: string; email: string; active: boolean }>): Promise<User | null> {
    const user = await this.getById(id);
    if (!user) return null;

    if (data.name !== undefined) user.name = data.name;
    if (data.email !== undefined) user.email = data.email;
    if (data.active !== undefined) user.active = data.active;

    await this.session.commit();
    return user;
  }

  async delete(id: number): Promise<boolean> {
    const user = await this.getById(id);
    if (!user) return false;

    const result = await deleteFrom(User)
      .where(eq(entityRef(User).id, id))
      .execute(this.session);
    return true;
  }
}

// Schemas for validation
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  active: z.boolean().optional(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  active: z.boolean().optional(),
});

const IdParamsSchema = z.object({
  id: z.coerce.number().positive(),
});

type CreateUserDto = z.infer<typeof CreateUserSchema>;
type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
type IdParams = z.infer<typeof IdParamsSchema>;

// Define the UserController
@Controller('/users')
class UserController {
  private getService(): UserService {
    const session = (global as any).ormSession;
    if (!session) {
      throw new Error('ORM session not available');
    }
    return new UserService(session);
  }

  @Get()
  async getAll() {
    const service = this.getService();
    return await service.getAll();
  }

  @Get('/:id')
  @Params(IdParamsSchema)
  async getById(params: IdParams) {
    const service = this.getService();
    const user = await service.getById(params.id);
    if (!user) {
      return { error: 'User not found', status: 404 };
    }
    return user;
  }

  @Post()
  @Body(CreateUserSchema)
  async create(body: CreateUserDto) {
    const service = this.getService();
    return await service.create(body);
  }

  @Put('/:id')
  @Schema({
    params: IdParamsSchema,
    body: UpdateUserSchema,
  })
  async update(input: { params: IdParams; body: UpdateUserDto }) {
    const service = this.getService();
    const user = await service.update(input.params.id, input.body);
    if (!user) {
      return { error: 'User not found', status: 404 };
    }
    return user;
  }

  @Delete('/:id')
  @Params(IdParamsSchema)
  async delete(params: IdParams) {
    const service = this.getService();
    const success = await service.delete(params.id);
    if (!success) {
      return { error: 'User not found', status: 404 };
    }
    return { success: true };
  }
}

describe('E2E: User CRUD with MetalORM, SQLite in-memory', () => {
  let app: express.Application;
  let db: Database.Database;
  let orm: Orm;
  let session: any;

  beforeEach(async () => {
    // Set up SQLite in-memory database
    db = new Database.Database(':memory:');

    // Create a wrapper that implements SqliteClientLike
    const sqliteClient = {
      all: (sql: string, params?: unknown[]) => new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Record<string, unknown>[]);
        });
      }),
      run: (sql: string, params?: unknown[]) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve(this);
        });
      }),
    };

    // Create executor
    const executor = createSqliteExecutor(sqliteClient);

    // Create ORM
    orm = new Orm({
      dialect: new SqliteDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => {},
      },
    });

    // Bootstrap entities
    bootstrapEntities();

    // Create table manually
    await new Promise<void>((resolve, reject) => {
      db.run(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          active BOOLEAN DEFAULT 0
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Create session
    session = orm.createSession();
    (global as any).ormSession = session;

    // Set up Express app
    app = express();
    app.use(express.json());

    // Register controller
    const adapter = new ExpressAdapter(app);
    adapter.registerController(UserController);
  });

  afterEach(async () => {
    if (session) {
      await session.dispose();
    }
    if (db) {
      db.close();
    }
    (global as any).ormSession = undefined;
  });

  it('should perform complete CRUD operations', async () => {
    // 1. Create a user
    const createResponse = await request(app)
      .post('/users')
      .send({ name: 'John Doe', email: 'john@example.com' })
      .expect(200);

    expect(createResponse.body).toHaveProperty('id');
    expect(createResponse.body.name).toBe('John Doe');
    expect(createResponse.body.email).toBe('john@example.com');
    expect(createResponse.body.active).toBe(0);

    const userId = createResponse.body.id;

    // 2. Get the user by ID
    const getResponse = await request(app)
      .get(`/users/${userId}`)
      .expect(200);

    expect(getResponse.body.id).toBe(userId);
    expect(getResponse.body.name).toBe('John Doe');
    expect(getResponse.body.email).toBe('john@example.com');
    expect(getResponse.body.active).toBe(0);

    // 3. Get all users
    const getAllResponse = await request(app)
      .get('/users')
      .expect(200);

    expect(getAllResponse.body).toHaveLength(1);
    expect(getAllResponse.body[0].id).toBe(userId);

    // 4. Update the user
    const updateResponse = await request(app)
      .put(`/users/${userId}`)
      .send({ name: 'Jane Doe', active: true })
      .expect(200);

    expect(updateResponse.body.id).toBe(userId);
    expect(updateResponse.body.name).toBe('Jane Doe');
    expect(updateResponse.body.email).toBe('john@example.com');
    expect(updateResponse.body.active).toBe(true);

    // 5. Delete the user
    await request(app)
      .delete(`/users/${userId}`)
      .expect(200);

    // 6. Verify user is deleted
    await request(app)
      .get(`/users/${userId}`)
      .expect(200)
      .then(response => {
        expect(response.body).toEqual({ error: 'User not found', status: 404 });
      });

    // 7. Verify no users left
    const getAllAfterDelete = await request(app)
      .get('/users')
      .expect(200);

    expect(getAllAfterDelete.body).toHaveLength(0);
  });

  it('should handle non-existent user', async () => {
    await request(app)
      .get('/users/999')
      .expect(200)
      .then(response => {
        expect(response.body).toEqual({ error: 'User not found', status: 404 });
      });

    await request(app)
      .put('/users/999')
      .send({ name: 'Updated Name' })
      .expect(200)
      .then(response => {
        expect(response.body).toEqual({ error: 'User not found', status: 404 });
      });

    await request(app)
      .delete('/users/999')
      .expect(200)
      .then(response => {
        expect(response.body).toEqual({ error: 'User not found', status: 404 });
      });
  });

  it('should validate input data', async () => {
    // Invalid email
    await request(app)
      .post('/users')
      .send({ name: 'John', email: 'invalid-email' })
      .expect(400);

    // Empty name
    await request(app)
      .post('/users')
      .send({ name: '', email: 'john@example.com' })
      .expect(400);

    // Missing required fields
    await request(app)
      .post('/users')
      .send({ email: 'john@example.com' })
      .expect(400);
  });
});
