import { eq, selectFromEntity, type OrmSession } from 'metal-orm';

import { defineMetalQuery, type MetalQueryInput } from '../../contracts/query/metal.js';
import { summaryKeys, type SummaryOf } from '../../util/types.js';
import { Author, Post } from './entities.js';
import { authorRef } from './entities.registry.js';
import { withSession } from './sqlite.js';

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

type ListAuthorsQueryParams = Record<string, never>;

export const buildListAuthorsQuery = defineMetalQuery((query: ListAuthorsQueryParams) => {
  return selectFromEntity(Author)
    .select(...authorSummaryKeys)
    .include('posts', { columns: [...postSummaryKeys] });
});

export type ListAuthorsQueryInput = MetalQueryInput<typeof buildListAuthorsQuery>;

const fetchAuthorWithPosts = async (
  session: OrmSession,
  id: number
): Promise<AuthorSummary | undefined> => {
  const rows = await buildListAuthorsQuery({})
    .where(eq(authorRef.id, id))
    .limit(1)
    .execute(session);

  return rows[0] as unknown as AuthorSummary | undefined;
};

export class AuthorsRepository {
  async listAuthors(): Promise<AuthorSummary[]> {
    return withSession(async session => {
      const rows = await buildListAuthorsQuery({})
        .orderBy(authorRef.id, 'ASC')
        .execute(session);
      return rows as unknown as AuthorSummary[];
    });
  }

  async createAuthor(input: CreateAuthorInput): Promise<AuthorSummary> {
    return withSession(async session => {
      const createdAt = new Date().toISOString();
      const entity = await session.saveGraph(Author, {
        name: input.name,
        createdAt
      });

      if (input.posts?.length) {
        for (const post of input.posts) {
          await session.saveGraph(Post, {
            authorId: entity.id,
            title: post.title,
            body: post.body,
            createdAt
          });
        }
      }

      const author = await fetchAuthorWithPosts(session, entity.id);
      if (!author) {
        throw new Error('Failed to load created author');
      }
      return author;
    });
  }
}
