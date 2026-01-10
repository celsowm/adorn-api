import { and, eq, like, or, selectFromEntity, update, type ExpressionNode, type OrmSession } from 'metal-orm';

import type { ContractPaged, ContractQuery } from '../../contracts/types.js';
import { User } from './entities.js';
import { ListUsersContract, buildListUsersQuery, userSummaryKeys } from './users.contracts.js';
import type { CreateUserInput, SearchUsersInput, UserSummary } from './users.contracts.js';
import { userRef } from './entities.registry.js';
import { withSession } from './sqlite.js';
import { normalizePagination } from '../../util/pagination.js';

export class UsersRepository {
  async listUsers(
    query: ContractQuery<typeof ListUsersContract>
  ): Promise<ContractPaged<typeof ListUsersContract>> {
    return withSession(async session => {
      const { page, pageSize } = normalizePagination(
        { page: query.page, pageSize: query.pageSize },
        { maxPageSize: 50, defaultPageSize: 10 }
      );

      const baseQuery = buildListUsersQuery(query).orderBy(userRef.id, 'ASC');
      const result = await baseQuery.executePaged(session, { page, pageSize });

      return result as unknown as ContractPaged<typeof ListUsersContract>;
    });
  }

  async getUserById(id: number): Promise<UserSummary | undefined> {
    return withSession(async session => {
      const rows = await selectFromEntity(User)
        .select(...userSummaryKeys)
        .where(eq(userRef.id, id))
        .limit(1)
        .execute(session);
      return rows[0] as unknown as UserSummary | undefined;
    });
  }

  async createUser(input: CreateUserInput): Promise<UserSummary> {
    return withSession(async session => {
      const createdAt = new Date().toISOString();
      const entity = await session.saveGraph(User, {
        nome: input.nome,
        email: input.email,
        status: 'active',
        createdAt
      });

      return entity;
    });
  }

  async searchUsers(input: SearchUsersInput): Promise<UserSummary[]> {
    return withSession(async session => {
      const predicates: ExpressionNode[] = [];

      if (input.status) {
        predicates.push(eq(userRef.status, input.status));
      }

      if (input.term) {
        const term = `%${input.term}%`;
        predicates.push(or(like(userRef.nome, term), like(userRef.email, term)));
      }

      let qb = selectFromEntity(User).select(...userSummaryKeys);

      if (predicates.length === 1) {
        qb = qb.where(predicates[0]);
      } else if (predicates.length > 1) {
        qb = qb.where(and(...predicates));
      }

      return (await qb.execute(session)) as unknown as UserSummary[];
    });
  }

  async lockUser(id: number): Promise<UserSummary | undefined> {
    return withSession(async session => {
      await update(User)
        .set({ status: 'locked' })
        .where(eq(userRef.id, id))
        .execute(session);

      const rows = await selectFromEntity(User)
        .select(...userSummaryKeys)
        .where(eq(userRef.id, id))
        .limit(1)
        .execute(session);

      return rows[0] as unknown as UserSummary | undefined;
    });
  }
}
