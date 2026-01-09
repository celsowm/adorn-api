import type { ContractPaged, ContractQuery, ContractResult } from '../../contracts/types.js';
import { HttpError } from '../../http/errors.js';
import type { CreateUserInput, SearchUsersInput, UserSummary } from './users.contracts.js';
import {
  CreateUserContract,
  GetUserContract,
  ListUsersContract,
  SearchUsersContract
} from './users.contracts.js';
import { UsersRepository } from './users.repo.js';

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length ? value : undefined;

export class UsersService {
  constructor(private readonly repo: UsersRepository = new UsersRepository()) {}

  async listUsers(
    query: ContractQuery<typeof ListUsersContract>
  ): Promise<ContractPaged<typeof ListUsersContract>> {
    return this.repo.listUsers(query);
  }

  async getUserById(id: number): Promise<ContractResult<typeof GetUserContract>> {
    if (!Number.isFinite(id) || id <= 0) {
      throw new HttpError(400, 'Invalid id');
    }

    const user = await this.repo.getUserById(id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    return user;
  }

  async createUser(
    input: ContractQuery<typeof CreateUserContract>
  ): Promise<ContractResult<typeof CreateUserContract>> {
    const nome = asString(input?.nome);
    const email = asString(input?.email);

    if (!nome || !email) {
      throw new HttpError(400, 'Invalid payload', {
        message: 'nome and email are required'
      });
    }

    const payload: CreateUserInput = { nome, email };
    return this.repo.createUser(payload);
  }

  async searchUsers(
    input: ContractQuery<typeof SearchUsersContract>
  ): Promise<ContractResult<typeof SearchUsersContract>> {
    const payload: SearchUsersInput = {
      term: asString(input?.term),
      status: asString(input?.status) as SearchUsersInput['status']
    };
    return this.repo.searchUsers(payload);
  }

  async lockUser(id: number): Promise<UserSummary> {
    if (!Number.isFinite(id) || id <= 0) {
      throw new HttpError(400, 'Invalid id');
    }

    const user = await this.repo.lockUser(id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    return user;
  }
}
