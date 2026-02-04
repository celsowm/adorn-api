import {
  createMetalCrudDtoClasses,
  createMetalTreeDtoClasses
} from "../../src";
import { Category } from "./entity.entity";

const categoryCrud = createMetalCrudDtoClasses(Category, {
  response: {
    description: "Category returned by API."
  },
  mutationExclude: ["id", "lft", "rght", "depth"]
});

export const {
  response: CategoryDto,
  create: CreateCategoryDto,
  replace: ReplaceCategoryDto,
  update: UpdateCategoryDto,
  params: CategoryParamsDto
} = categoryCrud;

export const {
  node: CategoryNodeDto,
  nodeResult: CategoryNodeResultDto,
  threadedNode: CategoryThreadedNodeDto,
  treeListEntry: CategoryTreeListEntryDto,
  treeListSchema: CategoryTreeListSchema,
  threadedTreeSchema: CategoryThreadedTreeSchema
} = createMetalTreeDtoClasses(Category, {
  entityDto: CategoryDto
});
