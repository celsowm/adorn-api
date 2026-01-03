import { Controller, Get, QueryStyle } from "../../../../dist/index.js";

type WhereFilter = {
  responsavel?: {
    perfil?: {
      nome?: string;
    };
  };
  tags?: string[];
};

type FlatFilters = {
  status?: string;
  responsavelId?: number;
};

@Controller("/posts")
export class PostController {
  @Get("/")
  @QueryStyle({ style: "deepObject" })
  async list(where?: WhereFilter): Promise<WhereFilter | undefined> {
    return where;
  }

  @Get("/flat")
  async listFlat(query?: FlatFilters): Promise<FlatFilters | undefined> {
    return query;
  }
}
