import { and, countAll, eq, insertInto, like, or, selectFrom, update, type ExpressionNode, type OrmSession } from 'metal-orm';

import type { ContractPaged, ContractQuery } from '../contracts/types.js';
import { ListUsersContract, buildListUsersQuery, usersTable } from './users.contracts.js';
import type { CreateUserInput, SearchUsersInput, UserSummary } from './users.contracts.js';
import { withSession } from './sqlite.js';

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const executeInsert = async (session: OrmSession, input: CreateUserInput): Promise<UserSummary> => {
  const createdAt = new Date().toISOString();
  const insert = insertInto(usersTable).values({
    nome: input.nome,
    email: input.email,
    status: 'active',
    createdAt
  });
  const compiled = insert.compile(session.orm.dialect);
  await session.executor.executeSql(compiled.sql, compiled.params);

  const [row] = await selectFrom(usersTable)
    .select('id', 'nome', 'email', 'status', 'createdAt')
    .where(eq(usersTable.columns.email, input.email))
    .orderBy(usersTable.columns.id, 'DESC')
    .limit(1)
    .execute(session);

  return row as UserSummary;
};

export class UsersRepository {
  async listUsers(
    query: ContractQuery<typeof ListUsersContract>
  ): Promise<ContractPaged<typeof ListUsersContract>> {
    return withSession(async session => {
      const page = Math.max(1, toNumber(query.page, 1));
      const pageSize = Math.min(50, Math.max(1, toNumber(query.pageSize, 10)));
      const offset = (page - 1) * pageSize;

      const baseQuery = buildListUsersQuery(query);
      const items = await baseQuery
        .orderBy(usersTable.columns.id, 'ASC')
        .limit(pageSize)
        .offset(offset)
        .execute(session);

      const totalQuery = buildListUsersQuery(query).select({ total: countAll() });
      const totalRows = await totalQuery.execute(session);
      const totalItems = toNumber(totalRows[0]?.total, 0);

      return {
        items: items as UserSummary[],
        totalItems,
        page,
        pageSize
      };
    });
  }

  async getUserById(id: number): Promise<UserSummary | undefined> {
    return withSession(async session => {
      const rows = await selectFrom(usersTable)
        .select('id', 'nome', 'email', 'status', 'createdAt')
        .where(eq(usersTable.columns.id, id))
        .limit(1)
        .execute(session);
      return rows[0] as UserSummary | undefined;
    });
  }

  async createUser(input: CreateUserInput): Promise<UserSummary> {
    return withSession(async session => executeInsert(session, input));
  }

  async searchUsers(input: SearchUsersInput): Promise<UserSummary[]> {
    return withSession(async session => {
      const predicates: ExpressionNode[] = [];

      if (input.status) {
        predicates.push(eq(usersTable.columns.status, input.status));
      }

      if (input.term) {
        const term = `%${input.term}%`;
        predicates.push(or(like(usersTable.columns.nome, term), like(usersTable.columns.email, term)));
      }

      let qb = selectFrom(usersTable).select('id', 'nome', 'email', 'status', 'createdAt');

      if (predicates.length === 1) {
        qb = qb.where(predicates[0]);
      } else if (predicates.length > 1) {
        qb = qb.where(and(...predicates));
      }

      return (await qb.execute(session)) as UserSummary[];
    });
  }

  async lockUser(id: number): Promise<UserSummary | undefined> {
    return withSession(async session => {
      await update(usersTable)
        .set({ status: 'locked' })
        .where(eq(usersTable.columns.id, id))
        .execute(session);

      const rows = await selectFrom(usersTable)
        .select('id', 'nome', 'email', 'status', 'createdAt')
        .where(eq(usersTable.columns.id, id))
        .limit(1)
        .execute(session);

      return rows[0] as UserSummary | undefined;
    });
  }
}
