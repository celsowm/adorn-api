import express from 'express';
import { Database } from 'better-sqlite3';
import { col, defineTable, selectFromEntity, insertInto } from 'metal-orm';
import { Controller, Get, Post, Put, Patch, Delete, ExpressAdapter, OpenApiGenerator, DtoResponse, type HttpContext } from '../../src/index.js';

const usersTable = defineTable('users', {
  id: col.primaryKey(col.autoIncrement(col.int())),
  name: col.notNull(col.varchar(100)),
  email: col.notNull(col.varchar(255)),
  age: col.int(),
  active: col.default(col.boolean(), true),
  createdAt: col.default(col.timestamp(), { raw: 'CURRENT_TIMESTAMP' }),
});

@Controller('/api/users')
class UsersController {
  @Get()
  @DtoResponse(usersTable)
  async getAllUsers() {
    const db = await Database.open(':memory:');
    return await selectFromEntity(usersTable).execute(db);
  }

  @Get('/:id')
  @DtoResponse(usersTable)
  async getUserById(ctx: HttpContext) {
    const db = await Database.open(':memory:');
    const [user] = await selectFromEntity(usersTable)
      .where((u) => u.id.equals(parseInt(ctx.params.param('id') || '0')))
      .execute(db);
    return user;
  }

  @Post('/')
  async createUser(ctx: HttpContext) {
    const db = await Database.open(':memory:');
    const result = await insertInto(usersTable).values(ctx.req.body).execute(db);
    return result;
  }

  @Put('/:id')
  @DtoResponse(usersTable)
  async updateUser(ctx: HttpContext) {
    const db = await Database.open(':memory:');
    const id = parseInt(ctx.params.param('id') || '0');
    const [user] = await selectFromEntity(usersTable)
      .where((u) => u.id.equals(id))
      .execute(db);
    if (!user) {
      throw new Error('User not found');
    }
    return { ...user, ...ctx.req.body };
  }

  @Patch('/:id')
  @DtoResponse(usersTable)
  async patchUser(ctx: HttpContext) {
    const db = await Database.open(':memory:');
    const id = parseInt(ctx.params.param('id') || '0');
    const [user] = await selectFromEntity(usersTable)
      .where((u) => u.id.equals(id))
      .execute(db);
    if (!user) {
      throw new Error('User not found');
    }
    return { ...user, ...ctx.req.body };
  }

  @Delete('/:id')
  async deleteUser(ctx: HttpContext) {
    const db = await Database.open(':memory:');
    const id = parseInt(ctx.params.param('id') || '0');
    await db.exec('DELETE FROM users WHERE id = ?', [id]);
    return { message: 'User deleted' };
  }
}

const app = express();
app.use(express.json());

const adapter = new ExpressAdapter(app);
adapter.registerController(UsersController);

const generator = new OpenApiGenerator();
const openApiDoc = generator.generateDocument({
  info: {
    title: 'Users API with Metal-ORM',
    version: '1.0.0',
    description: 'An API demonstrating Adorn-API integration with Metal-ORM',
  },
});

app.get('/api-docs', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(openApiDoc, null, 2));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`OpenAPI docs available at http://localhost:${PORT}/api-docs`);
});
