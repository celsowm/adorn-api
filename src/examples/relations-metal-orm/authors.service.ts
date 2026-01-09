import type { AuthorSummary, CreateAuthorInput } from './relations.contracts.js';
import { AuthorsRepository } from './authors.repo.js';

export class AuthorsService {
  private readonly repo = new AuthorsRepository();

  async listAuthors(): Promise<AuthorSummary[]> {
    return this.repo.listAuthors();
  }

  async createAuthor(input: CreateAuthorInput): Promise<AuthorSummary> {
    return this.repo.createAuthor(input);
  }
}
