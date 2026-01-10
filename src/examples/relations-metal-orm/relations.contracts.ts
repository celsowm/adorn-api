import { selectFromEntity, type SchemaOptions } from 'metal-orm';

import { registerContract } from '../../contracts/builder.js';
import { createMetalContract } from '../../contracts/query/metal.js';
import { Author, Post } from './entities.js';
import './entities.registry.js';
import { summaryKeys, type SummaryOf } from '../../util/types.js';

export const postSummaryKeys = summaryKeys<Post>()('id', 'authorId', 'title', 'body', 'createdAt');

export type PostSummary = SummaryOf<Post, typeof postSummaryKeys>;

export const authorSummaryKeys = summaryKeys<Author>()('id', 'name', 'createdAt');

export type AuthorSummary = SummaryOf<Author, typeof authorSummaryKeys> & {
  posts: PostSummary[];
};

export type CreatePostInput = Pick<Post, 'title' | 'body'>;

export type CreateAuthorInput = Pick<Author, 'name'> & {
  posts?: CreatePostInput[];
};

export type ListAuthorsQueryInput = Record<string, never>;

const authorSchemaOptions = {
  mode: 'selected',
  refMode: 'components'
} satisfies SchemaOptions;

const authorCreateSchemaOptions = {
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
} satisfies SchemaOptions;

export const buildListAuthorsQuery = (_query: ListAuthorsQueryInput) => {
  return selectFromEntity(Author)
    .select(...authorSummaryKeys)
    .include('posts', { columns: [...postSummaryKeys] });
};

const resolveAuthorSchemas = () => {
  const bundle = buildListAuthorsQuery({}).getSchema(authorCreateSchemaOptions);
  return {
    input: bundle.input,
    output: bundle.output,
    components: bundle.components
  };
};

export const ListAuthorsContract = createMetalContract<ListAuthorsQueryInput, AuthorSummary>(
  'ListAuthors',
  buildListAuthorsQuery,
  {
    mode: 'list',
    schemaOptions: authorSchemaOptions
  }
);

export const CreateAuthorContract = registerContract<CreateAuthorInput, AuthorSummary, AuthorSummary>(
  'CreateAuthor',
  {
    mode: 'single',
    resolveSchemas: resolveAuthorSchemas
  }
);
