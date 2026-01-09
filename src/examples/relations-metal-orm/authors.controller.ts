import {
  Contract,
  Controller,
  Get,
  Post,
  Response,
  Summary
} from '../../core/decorators/index.js';
import type { HttpContext } from '../../http/context.js';
import type { AuthorSummary, CreateAuthorInput } from './relations.contracts.js';
import { CreateAuthorContract, ListAuthorsContract } from './relations.contracts.js';
import { AuthorsService } from './authors.service.js';

@Controller({ path: '/authors', tags: ['Authors'] })
export class AuthorsController {
  private readonly service = new AuthorsService();

  @Get('/')
  @Summary('List authors with their posts')
  @Contract(ListAuthorsContract)
  async list(): Promise<AuthorSummary[]> {
    return this.service.listAuthors();
  }

  @Post('/')
  @Summary('Create an author (optionally with posts)')
  @Response(400, 'Validation error')
  @Contract(CreateAuthorContract)
  async create(ctx: HttpContext): Promise<AuthorSummary> {
    return this.service.createAuthor(ctx.body as CreateAuthorInput);
  }
}
