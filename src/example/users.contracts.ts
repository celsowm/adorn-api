import {
  Column,
  Entity,
  PrimaryKey,
  and,
  bootstrapEntities,
  col,
  entityRef,
  eq,
  like,
  selectFromEntity,
  type ExpressionNode
} from 'metal-orm';

import { registerContract } from '../contracts/builder.js';
import { createMetalContract } from '../contracts/query/metal.js';

export type UserStatus = 'active' | 'locked';

export type UserSummary = {
  id: number;
  nome: string;
  email: string;
  status: UserStatus;
  createdAt: string;
};

export type CreateUserInput = {
  nome: string;
  email: string;
};

export type SearchUsersInput = {
  term?: string;
  status?: UserStatus;
};

export type ListUsersQueryInput = {
  filter?: { nome?: string; status?: UserStatus };
  page?: number;
  pageSize?: number;
};

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

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    nome: { type: 'string' },
    email: { type: 'string' },
    status: { type: 'string', enum: ['active', 'locked'] },
    createdAt: { type: 'string' }
  },
  required: ['id', 'nome', 'email', 'status', 'createdAt']
};

const createUserSchema = {
  type: 'object',
  properties: {
    nome: { type: 'string' },
    email: { type: 'string' }
  },
  required: ['nome', 'email']
};

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
    output: userSchema
  }
});

export const CreateUserContract = registerContract<CreateUserInput, UserSummary, UserSummary>(
  'CreateUser',
  {
    mode: 'single',
    schemas: {
      input: createUserSchema,
      output: userSchema
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
          status: { type: 'string', enum: ['active', 'locked'] }
        }
      },
      output: {
        type: 'array',
        items: userSchema
      }
    }
  }
);
