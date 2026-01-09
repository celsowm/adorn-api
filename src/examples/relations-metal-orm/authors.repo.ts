import { eq, type OrmSession } from 'metal-orm';

import type { AuthorSummary, CreateAuthorInput } from './relations.contracts.js';
import { AuthorEntity, PostEntity, authorRef, buildListAuthorsQuery } from './relations.contracts.js';
import { withSession } from './sqlite.js';

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
      const entity = await session.saveGraph(AuthorEntity, {
        name: input.name,
        createdAt
      });

      if (input.posts?.length) {
        for (const post of input.posts) {
          await session.saveGraph(PostEntity, {
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
