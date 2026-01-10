import { and, eq, like, or, selectFromEntity, update, type ExpressionNode } from 'metal-orm';

import { defineMetalQuery, type MetalQueryInput } from '../../contracts/query/metal.js';
import type { Paginated } from '../../contracts/types.js';
import { normalizePagination } from '../../util/pagination.js';
import { summaryKeys, type SummaryOf } from '../../util/types.js';
import { User } from './entities.js';
import { userRef } from './entities.registry.js';
import { withSession } from './sqlite.js';

export const userSummaryKeys = summaryKeys<User>()('id', 'nome', 'email', 'status', 'createdAt');

export const buildListUsersQuery = defineMetalQuery((query: {
  filter?: Partial<Pick<User, 'nome' | 'status'>>;
  page?: number;
  pageSize?: number;
}) => {
  const predicates: ExpressionNode[] = [];

  if (query.filter?.status) {
    predicates.push(eq(userRef.status, query.filter.status));
  }

  if (query.filter?.nome !== undefined) {
    const raw = query.filter.nome;
    const pattern = typeof raw === 'string' ? `%${raw}%` : raw;
    predicates.push(like(userRef.nome, pattern));
  }

  let qb = selectFromEntity(User).select(...userSummaryKeys);

  if (predicates.length === 1) {
    qb = qb.where(predicates[0]);
  } else if (predicates.length > 1) {
    qb = qb.where(and(...predicates));
  }

  return qb;
});

export type ListUsersQueryInput = MetalQueryInput<typeof buildListUsersQuery>;
export type UserSummary = SummaryOf<User, typeof userSummaryKeys>;

export type CreateUserInput = Pick<User, 'nome' | 'email'>;
export type SearchUsersInput = { term?: string } & Partial<Pick<User, 'status'>>;

export class UsersRepository {
  async listUsers(query: ListUsersQueryInput): Promise<Paginated<UserSummary>> {
    return withSession(async session => {
      const { page, pageSize } = normalizePagination(
        { page: query.page, pageSize: query.pageSize },
        { maxPageSize: 50, defaultPageSize: 10 }
      );

      const baseQuery = buildListUsersQuery(query).orderBy(userRef.id, 'ASC');
      const result = await baseQuery.executePaged(session, { page, pageSize });

      return result;
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
