import {
  Column,
  Entity,
  PrimaryKey,
  and,
  bootstrapEntities,
  col,
  entityRef,
  eq,
  getTableDefFromEntity,
  like,
  selectFromEntity,
  type ExpressionNode
} from 'metal-orm';

import { registerContract } from '../../contracts/builder.js';
import { createMetalContract } from '../../contracts/query/metal.js';
import { defineEntitySchemaBundle } from '../../metal/entity.js';
import { arraySchema } from '../../openapi/schema.js';

const userStatusValues = ['active', 'locked'] as const;
export type UserStatus = (typeof userStatusValues)[number];

@Entity({ tableName: 'usuarios' })
export class UserEntity {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  nome!: string;

  @Column(col.notNull(col.varchar(255)))
  email!: string;

  @Column(col.notNull(col.varchar(20)))
  status!: UserStatus;

  @Column(col.notNull(col.varchar(30)))
  createdAt!: string;
}

export type UserSummary = Pick<UserEntity, 'id' | 'nome' | 'email' | 'status' | 'createdAt'>;

export type CreateUserInput = Pick<UserEntity, 'nome' | 'email'>;

export type SearchUsersInput = { term?: string } & Partial<Pick<UserEntity, 'status'>>;

export type ListUsersQueryInput = {
  filter?: Partial<Pick<UserEntity, 'nome' | 'status'>>;
  page?: number;
  pageSize?: number;
};

let entitiesReady = false;
const ensureEntities = () => {
  if (!entitiesReady) {
    bootstrapEntities();
    entitiesReady = true;
  }
};

export const userRef = (() => {
  ensureEntities();
  return entityRef(UserEntity);
})();

export const usersTable = (() => {
  ensureEntities();
  const table = getTableDefFromEntity(UserEntity);
  if (!table) {
    throw new Error(`Entity '${UserEntity.name}' is not registered with decorators or has not been bootstrapped`);
  }
  return table;
})();

const userStatusSchema = {
  type: 'string',
  enum: userStatusValues
};

const { output: userSchema, input: createUserSchema } = defineEntitySchemaBundle(UserEntity, {
  name: 'User',
  inputName: 'CreateUser',
  output: { overrides: { status: userStatusSchema } },
  input: { pick: ['nome', 'email'] }
});

const userOutputSchemas = { output: userSchema };
const userListSchema = arraySchema(userSchema);

export const buildListUsersQuery = (query: ListUsersQueryInput) => {
  ensureEntities();
  const predicates: ExpressionNode[] = [];

  if (query.filter?.status) {
    predicates.push(eq(userRef.status, query.filter.status));
  }

  if (query.filter?.nome !== undefined) {
    const raw = query.filter.nome;
    const pattern = typeof raw === 'string' ? `%${raw}%` : raw;
    predicates.push(like(userRef.nome, pattern));
  }

  let qb = selectFromEntity(UserEntity).select('id', 'nome', 'email', 'status', 'createdAt');

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
