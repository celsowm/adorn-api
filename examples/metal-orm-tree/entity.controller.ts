import {
  Controller,
  Get,
  HttpError,
  Params,
  Returns,
  parseIdOrThrow,
  withSession,
  type RequestContext
} from "../../src";
import {
  createTreeManager,
  formatTreeList,
  getTableDefFromEntity,
  threadResults,
  treeQuery
} from "metal-orm";
import { createSession } from "./db";
import { Category } from "./entity.entity";
import {
  CategoryNodeResultDto,
  CategoryParamsDto,
  CategoryThreadedTreeSchema,
  CategoryTreeListSchema
} from "./entity.dtos";

const categoryTable = getTableDefFromEntity(Category);
if (!categoryTable) {
  throw new Error("Category entity metadata was not initialized.");
}

const tree = treeQuery(categoryTable, {
  parentKey: "parentId",
  leftKey: "lft",
  rightKey: "rght",
  depthKey: "depth"
});

@Controller("/categories")
export class CategoryController {
  @Get("/tree")
  @Returns(CategoryThreadedTreeSchema)
  async tree() {
    return withSession(createSession, async (session) => {
      const rows = await tree.findTreeList().execute(session);
      return threadResults(rows, tree.config.leftKey, tree.config.rightKey);
    });
  }

  @Get("/list")
  @Returns(CategoryTreeListSchema)
  async list() {
    return withSession(createSession, async (session) => {
      const rows = await tree.findTreeList().execute(session);
      return formatTreeList(rows, {
        keyPath: "id",
        valuePath: "name",
        depthKey: tree.config.depthKey,
        leftKey: tree.config.leftKey,
        rightKey: tree.config.rightKey
      });
    });
  }

  @Get("/:id")
  @Params(CategoryParamsDto)
  @Returns(CategoryNodeResultDto)
  async getNode(ctx: RequestContext<unknown, undefined, { id: string | number }>) {
    const id = parseIdOrThrow(ctx.params.id, "Category");
    return withSession(createSession, async (session) => {
      const manager = createTreeManager(session, categoryTable, tree.config);
      const node = await manager.getNode(id);
      if (!node) {
        throw new HttpError(404, "Category not found.");
      }
      return node;
    });
  }
}
