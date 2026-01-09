import {
  Contract,
  Controller,
  Get,
  Post,
  Response,
  Summary,
  Tags
} from '../core/decorators/index.js';
import type { ContractPaged, ContractQuery, ContractResult } from '../contracts/types.js';
import type { HttpContext } from '../http/context.js';
import type {
  CreateUserInput,
  SearchUsersInput,
  UserStatus,
  UserSummary
} from './users.contracts.js';
import {
  CreateUserContract,
  GetUserContract,
  ListUsersContract,
  SearchUsersContract
} from './users.contracts.js';
import { UsersService } from './users.service.js';

type ListUsersQuery = ContractQuery<typeof ListUsersContract>;
type ListUsersResult = ContractPaged<typeof ListUsersContract>;
type SearchUsersResult = ContractResult<typeof SearchUsersContract>;

const toNumber = (value: unknown): number => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

@Controller({ path: '/usuarios', tags: ['Users'] })
export class UsersController {
  private readonly service = new UsersService();

  @Get('/')
  @Summary('List users with optional deepObject filters')
  @Contract(ListUsersContract)
  async list(ctx: HttpContext): Promise<ListUsersResult> {
    return this.service.listUsers(ctx.query as ListUsersQuery);
  }

  @Get('/:id')
  @Summary('Get a single user by id')
  @Response(404, 'Not Found')
  @Contract(GetUserContract)
  async getById(ctx: HttpContext): Promise<UserSummary> {
    const id = toNumber(ctx.params.id);
    return this.service.getUserById(id);
  }

  @Post('/')
  @Summary('Create a user')
  @Response(400, 'Validation error')
  @Contract(CreateUserContract)
  async create(ctx: HttpContext): Promise<UserSummary> {
    return this.service.createUser(ctx.body as CreateUserInput);
  }

  @Post('/search', {
    requestBody: { required: false, description: 'Optional filters for non-REST search' }
  })
  @Summary('Search users using a request body payload')
  @Contract(SearchUsersContract)
  async search(ctx: HttpContext): Promise<SearchUsersResult> {
    return this.service.searchUsers(ctx.body as SearchUsersInput);
  }

  @Post('/:id/lock', { requestBody: false, summary: 'Lock a user account' })
  @Tags('Admin')
  @Response(404, 'Not Found')
  async lock(ctx: HttpContext): Promise<{ id: number; status: UserStatus }> {
    const id = toNumber(ctx.params.id);
    const user = await this.service.lockUser(id);
    return { id: user.id, status: user.status };
  }
}
