import {
  and,
  eq,
  like,
  selectFromEntity,
  type ExpressionNode
} from 'metal-orm';

import { registerContract } from '../../contracts/builder.js';
import { createMetalContract } from '../../contracts/query/metal.js';
import { defineEntitySchemaBundle } from '../../metal/entity.js';
import { arraySchema } from '../../openapi/schema.js';
import { User, userStatusValues } from './entities.js';
import { userRef } from './entities.registry.js';
import { summaryKeys, type SummaryOf } from '../../util/types.js';

export type { UserStatus } from './entities.js';

export const userSummaryKeys = summaryKeys<User>()('id', 'nome', 'email', 'status', 'createdAt');

export type UserSummary = SummaryOf<User, typeof userSummaryKeys>;

export type CreateUserInput = Pick<User, 'nome' | 'email'>;

export type SearchUsersInput = { term?: string } & Partial<Pick<User, 'status'>>;

export type ListUsersQueryInput = {
  filter?: Partial<Pick<User, 'nome' | 'status'>>;
  page?: number;
  pageSize?: number;
};

const userStatusSchema = {
  type: 'string',
  enum: userStatusValues
};

const { output: userSchema, input: createUserSchema } = defineEntitySchemaBundle(User, {
  name: 'User',
  inputName: 'CreateUser',
  output: { overrides: { status: userStatusSchema } },
  input: { pick: ['nome', 'email'] }
});

const userOutputSchemas = { output: userSchema };
const userListSchema = arraySchema(userSchema);

export const buildListUsersQuery = (query: ListUsersQueryInput) => {
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
};

export const ListUsersContract = createMetalContract<ListUsersQueryInput, UserSummary>(
  'ListUsers',
  buildListUsersQuery,
  { mode: 'paged', schemaOptions: { mode: 'selected' } }
);

export const GetUserContract = registerContract<{ id: number }, UserSummary, UserSummary>('GetUser', {
  mode: 'single',
  schemas: {
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer' }
      }
    ],
    ...userOutputSchemas
  }
});

export const CreateUserContract = registerContract<CreateUserInput, UserSummary, UserSummary>(
  'CreateUser',
  {
    mode: 'single',
    schemas: {
      input: createUserSchema,
      ...userOutputSchemas
    }
  }
);

export const SearchUsersContract = registerContract<SearchUsersInput, UserSummary, UserSummary[]>(
  'SearchUsers',
  {
    mode: 'list',
    schemas: {
      input: {
        type: 'object',
        properties: {
          term: { type: 'string' },
          status: userStatusSchema
        }
      },
      output: userListSchema
    }
  }
);
