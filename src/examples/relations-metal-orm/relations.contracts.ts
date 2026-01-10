import type { SchemaOptions } from 'metal-orm';
import { registerContract } from '../../contracts/builder.js';
import { createMetalContractFromQuery } from '../../contracts/query/metal.js';
import './entities.registry.js';
import { buildListAuthorsQuery, type AuthorSummary, type CreateAuthorInput } from './authors.repo.js';

export type { AuthorSummary, CreateAuthorInput } from './authors.repo.js';

const authorSchemaOptions: SchemaOptions = {
  mode: 'selected',
  refMode: 'components'
};

const authorCreateSchemaOptions: SchemaOptions = {
  ...authorSchemaOptions,
  input: {
    mode: 'create',
    includeRelations: true,
    relationMode: 'objects',
    excludePrimaryKey: true,
    omitReadOnly: true,
    excludeRelationForeignKeys: true,
    relationSelections: {
      posts: { pick: ['title', 'body'] }
    }
  }
};

const resolveAuthorSchemas = () => {
  const bundle = buildListAuthorsQuery({}).getSchema(authorCreateSchemaOptions);
  return {
    input: bundle.input,
    output: bundle.output,
    components: bundle.components
  };
};

export const ListAuthorsContract = createMetalContractFromQuery<
  typeof buildListAuthorsQuery,
  AuthorSummary
>('ListAuthors', buildListAuthorsQuery, {
  mode: 'list',
  schemaOptions: authorSchemaOptions
});

export const CreateAuthorContract = registerContract<CreateAuthorInput, AuthorSummary, AuthorSummary>(
  'CreateAuthor',
  {
    mode: 'single',
    resolveSchemas: resolveAuthorSchemas
  }
);
