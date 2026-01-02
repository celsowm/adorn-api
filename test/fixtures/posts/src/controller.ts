import { Controller, Get, QueryStyle } from "../../../../dist/index.js";

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
  @QueryStyle({ style: "deepObject" })
  async list(where?: WhereFilter): Promise<WhereFilter | undefined> {
    return where;
  }
}
