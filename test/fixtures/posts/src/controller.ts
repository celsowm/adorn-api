import { Controller, Get, QueryStyle } from "../../../../dist/index.js";

type Filters = {
  status?: string;
  responsavelId?: number;
};

type WhereFilter = {
  responsavel?: {
    perfil?: {
      nome?: string;
    };
  };
  tags?: string[];
};

@Controller("/posts")
export class PostController {
  @Get("/")
  async list(query?: Filters): Promise<Filters | undefined> {
    return query;
  }

  @Get("/search")
  @QueryStyle({ style: "deepObject" })
  async search(where?: WhereFilter): Promise<WhereFilter | undefined> {
    return where;
  }
}
