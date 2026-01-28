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
  ParseFilterOptions,
  PagedQueryDtoOptions,
  PagedResponseDtoOptions,
  PagedFilterQueryDtoOptions,
  FilterFieldDef,
  MetalCrudDtoOptions,
  MetalCrudDtoClassOptions,
  MetalCrudDtoDecorators,
  MetalCrudDtoClasses,
  MetalCrudDtoClassNames,
  NestedCreateDtoOptions,
  ErrorDtoOptions,
  CreateSessionFn
} from "./types";
