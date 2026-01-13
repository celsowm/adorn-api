import express from 'express';
import { Controller, Get, Post, Put, Patch, Delete, ExpressAdapter, OpenApiGenerator, type HttpContext } from 'adorn-api';

@Controller('/api/users')
class UsersController {
  private users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
  ];

  @Get()
  getAllUsers() {
    return this.users;
  }

  @Get('/:id')
  getUserById(ctx: HttpContext) {
    const id = parseInt(ctx.params.param('id') || '0');
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  @Post('/')
  createUser(ctx: HttpContext) {
    const newUser = ctx.req.body;
    newUser.id = this.users.length + 1;
    this.users.push(newUser);
    return newUser;
  }

  @Put('/:id')
  updateUser(ctx: HttpContext) {
    const id = parseInt(ctx.params.param('id') || '0');
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error('User not found');
    }
    this.users[index] = { ...this.users[index], ...ctx.req.body };
    return this.users[index];
  }

  @Patch('/:id')
  patchUser(ctx: HttpContext) {
    const id = parseInt(ctx.params.param('id') || '0');
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error('User not found');
    }
    this.users[index] = { ...this.users[index], ...ctx.req.body };
    return this.users[index];
  }

  @Delete('/:id')
  deleteUser(ctx: HttpContext) {
    const id = parseInt(ctx.params.param('id') || '0');
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error('User not found');
    }
    this.users.splice(index, 1);
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
    title: 'Users API',
    version: '1.0.0',
    description: 'A simple users API built with Adorn-API',
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
