import { Controller, Get, Post, Put, Delete, AuthorizedRoute } from '../../../src/core/decorators.js';

interface UserDTO {
  id: number;
  name: string;
  email: string;
}

interface CreateUserDTO {
  name: string;
  email: string;
}

interface UpdateUserDTO {
  name?: string;
  email?: string;
}

@Controller('/users')
export class ExampleController {
  
  @Get()
  async getAllUsers(): Promise<UserDTO[]> {
    return [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Doe', email: 'jane@example.com' }
    ];
  }

  @Get('/:id')
  async getUserById(id: number): Promise<UserDTO> {
    return { id, name: 'John Doe', email: 'john@example.com' };
  }

  @Post()
  async createUser(body: CreateUserDTO): Promise<UserDTO> {
    return { id: 3, ...body };
  }

  @Put('/:id')
  async updateUser(id: number, body: UpdateUserDTO): Promise<UserDTO> {
    return { id, name: body.name || 'John Doe', email: body.email || 'john@example.com' };
  }

  @Delete('/:id')
  async deleteUser(id: number): Promise<void> {
    // Delete logic here
  }

  @AuthorizedRoute('admin')
  @Get('/admin/stats')
  async getAdminStats(): Promise<{ totalUsers: number; activeUsers: number }> {
    return { totalUsers: 100, activeUsers: 75 };
  }
}
