import { registerContract } from '../../contracts/builder.js';
import { createMetalContractFromQuery } from '../../contracts/query/metal.js';
import { defineEntitySchemaBundle } from '../../metal/entity.js';
import { arraySchema } from '../../openapi/schema.js';
import { User, userStatusValues } from './entities.js';
import { buildListUsersQuery } from './users.repo.js';
import type { CreateUserInput, SearchUsersInput, UserSummary } from './users.repo.js';

export type { UserStatus } from './entities.js';
export type {
  CreateUserInput,
  ListUsersQueryInput,
  SearchUsersInput,
  UserSummary
} from './users.repo.js';

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

export const ListUsersContract = createMetalContractFromQuery<typeof buildListUsersQuery, UserSummary>(
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
