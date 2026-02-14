// Ensure standard decorator metadata is available for metal-orm transformers.
const symbolMetadata = (Symbol as { metadata?: symbol }).metadata;
if (!symbolMetadata) {
  (Symbol as { metadata?: symbol }).metadata = Symbol("Symbol.metadata");
}

export {
  MetalDto
} from "./dto";

export {
  parsePagination
} from "./pagination";

export {
  parseFilter,
  createFilterMappings
} from "./filters";

export {
  parseSort
} from "./sort";

export {
  runPagedList,
  executeCrudList
} from "./list";

export {
  createPagedQueryDtoClass,
  createPagedResponseDtoClass,
  createPagedFilterQueryDtoClass
} from "./paged-dtos";

export {
  createMetalCrudDtos,
  createMetalCrudDtoClasses,
  createNestedCreateDtoClass
} from "./crud-dtos";

export {
  createCrudController
} from "./crud-controller";

export {
  createMetalTreeDtoClasses
} from "./tree-dtos";

export {
  createMetalDtoOverrides,
  type CreateMetalDtoOverridesOptions
} from "./convention-overrides";

export {
  createErrorDtoClass,
  StandardErrorDto,
  SimpleErrorDto,
  BasicErrorDto
} from "./error-dtos";

export {
  withSession,
  parseIdOrThrow,
  compactUpdates,
  applyInput,
  getEntityOrThrow
} from "./utils";

export {
  validateEntityMetadata,
  hasValidEntityMetadata
} from "./field-builder";

export type {
  MetalDtoMode,
  MetalDtoOptions,
  MetalDtoTarget,
  PaginationConfig,
  PaginationOptions,
  ParsedPagination,
  Filter,
  FilterMapping,
  FilterFieldMapping,
  FilterFieldPath,
  FilterFieldPathArray,
  FilterFieldInput,
  RelationQuantifier,
  ParseFilterOptions,
  ParseSortOptions,
  ParsedSort,
  SortDirection,
  CrudListSortTerm,
  RunPagedListOptions,
  ExecuteCrudListOptions,
  CrudPagedResponse,
  ListConfig,
  PagedQueryDtoOptions,
  PagedResponseDtoOptions,
  PagedFilterQueryDtoOptions,
  FilterFieldDef,
  MetalCrudQueryFilterDef,
  MetalCrudSortableColumns,
  MetalCrudOptionsQueryOptions,
  MetalCrudQueryOptions,
  MetalCrudStandardErrorsOptions,
  MetalCrudDtoOptions,
  MetalCrudDtoClassOptions,
  MetalCrudDtoDecorators,
  MetalCrudDtoClasses,
  MetalCrudDtoClassNameKey,
  MetalCrudDtoClassNames,
  CrudControllerService,
  CrudControllerServiceInput,
  CreateCrudControllerOptions,
  RouteErrorsDecorator,
  NestedCreateDtoOptions,
  MetalTreeDtoClassOptions,
  MetalTreeDtoClasses,
  MetalTreeDtoClassNames,
  MetalTreeListEntryOptions,
  ErrorDtoOptions,
  CreateSessionFn
} from "./types";
