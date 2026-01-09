import {
  BelongsTo,
  Column,
  Entity,
  HasMany,
  PrimaryKey,
  bootstrapEntities,
  col,
  entityRef,
  selectFromEntity,
  type BelongsToReference,
  type HasManyCollection
} from 'metal-orm';

import { registerContract } from '../../contracts/builder.js';
import { defineEntitySchema } from '../../metal/entity.js';
import { arraySchema } from '../../openapi/schema.js';

export type PostSummary = {
  id: number;
  authorId: number;
  title: string;
  body?: string;
  createdAt: string;
};

export type AuthorSummary = {
  id: number;
  name: string;
  createdAt: string;
  posts: PostSummary[];
};

export type CreatePostInput = {
  title: string;
  body?: string;
};

export type CreateAuthorInput = {
  name: string;
  posts?: CreatePostInput[];
};

export type ListAuthorsQueryInput = Record<string, never>;

@Entity({ tableName: 'authors' })
export class AuthorEntity {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @Column(col.notNull(col.varchar(30)))
  createdAt!: string;

  @HasMany({ target: () => PostEntity, foreignKey: 'authorId' })
  posts!: HasManyCollection<PostEntity>;
}

@Entity({ tableName: 'posts' })
export class PostEntity {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  authorId!: number;

  @Column(col.notNull(col.varchar(255)))
  title!: string;

  @Column(col.varchar(2000))
  body?: string;

  @Column(col.notNull(col.varchar(30)))
  createdAt!: string;

  @BelongsTo({ target: () => AuthorEntity, foreignKey: 'authorId' })
  author?: BelongsToReference<AuthorEntity>;
}

let entitiesReady = false;
const ensureEntities = () => {
  if (!entitiesReady) {
    bootstrapEntities();
    entitiesReady = true;
  }
};

export const authorRef = (() => {
  ensureEntities();
  return entityRef(AuthorEntity);
})();

export const postRef = (() => {
  ensureEntities();
  return entityRef(PostEntity);
})();

const postSchema = defineEntitySchema('Post', {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    authorId: { type: 'integer' },
    title: { type: 'string' },
    body: { type: 'string' },
    createdAt: { type: 'string' }
  },
  required: ['id', 'authorId', 'title', 'createdAt']
});

const authorSchema = defineEntitySchema('Author', {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    createdAt: { type: 'string' },
    posts: { type: 'array', items: postSchema }
  },
  required: ['id', 'name', 'createdAt', 'posts']
});

const createAuthorSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' }
        },
        required: ['title']
      }
    }
  },
  required: ['name']
};

export const buildListAuthorsQuery = (_query: ListAuthorsQueryInput) => {
  ensureEntities();
  return selectFromEntity(AuthorEntity)
    .select('id', 'name', 'createdAt')
    .include('posts', { columns: ['id', 'authorId', 'title', 'body', 'createdAt'] });
};

export const ListAuthorsContract = registerContract<ListAuthorsQueryInput, AuthorSummary, AuthorSummary[]>(
  'ListAuthors',
  {
    mode: 'list',
    schemas: {
      output: arraySchema(authorSchema)
    },
    build: buildListAuthorsQuery
  }
);

export const CreateAuthorContract = registerContract<CreateAuthorInput, AuthorSummary, AuthorSummary>(
  'CreateAuthor',
  {
    mode: 'single',
    schemas: {
      input: createAuthorSchema,
      output: authorSchema
    }
  }
);
