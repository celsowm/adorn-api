import type { ColumnDef } from "metal-orm";
import type { DtoOptions, FieldOverride } from "../../core/decorators";
import type { SchemaNode } from "../../core/schema";
import type { DtoConstructor } from "../../core/types";

/**
 * Metal ORM DTO modes.
 */
export type MetalDtoMode = "response" | "create" | "update";

/**
 * Options for Metal ORM DTOs.
 * @extends DtoOptions
 */
export interface MetalDtoOptions extends DtoOptions {
  /** DTO mode */
  mode?: MetalDtoMode;
  /** Fields to include */
  include?: string[];
  /** Fields to exclude */
  exclude?: string[];
  /** Field overrides */
  overrides?: Record<string, FieldOverride>;
}

/**
 * Metal ORM DTO target type.
 */
export type MetalDtoTarget = Parameters<typeof import("metal-orm").getColumnMap>[0];

/**
 * Pagination configuration.
 */
export interface PaginationConfig {
  /** Default page size */
  defaultPageSize?: number;
  /** Maximum page size */
  maxPageSize?: number;
}

/**
 * Pagination parsing options.
 */
export interface PaginationOptions {
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Whether to clamp values */
  clamp?: boolean;
}

/**
 * Parsed pagination result.
 */
export interface ParsedPagination {
  /** Page number */
  page: number;
  /** Page size */
  pageSize: number;
}

/**
 * Filter field mapping.
 */
export interface FilterFieldMapping {
  /** Maps query keys to field names */
  [queryKey: string]: string;
}

/**
 * Filter mapping configuration.
 */
export interface FilterMapping {
  /** Field name */
  field: string;
  /** Filter operator */
  operator: "equals" | "contains" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte";
}

/**
 * Options for parsing filters.
 */
export interface ParseFilterOptions {
  /** Query parameters */
  query?: Record<string, unknown>;
  /** Field mappings */
  fieldMappings?: Record<string, FilterMapping>;
}

/**
 * Filter type for querying.
 */
export type Filter<T, K extends keyof T> = {
  [P in K]?: {
    equals?: T[P];
    contains?: T[P];
    startsWith?: T[P];
    endsWith?: T[P];
    gt?: T[P];
    gte?: T[P];
    lt?: T[P];
    lte?: T[P];
  };
};

/**
 * Options for paged query DTOs.
 */
export interface PagedQueryDtoOptions {
  /** Default page size */
  defaultPageSize?: number;
  /** Maximum page size */
  maxPageSize?: number;
  /** DTO name */
  name?: string;
}

/**
 * Options for paged response DTOs.
 */
export interface PagedResponseDtoOptions {
  /** Item DTO constructor */
  itemDto: DtoConstructor;
  /** DTO description */
  description?: string;
  /** DTO name */
  name?: string;
}

/**
 * Filter field definition.
 */
export interface FilterFieldDef {
  /** Field schema */
  schema?: SchemaNode;
  /** Filter operator */
  operator?: "equals" | "contains" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte";
}

/**
 * Options for paged filter query DTOs.
 * @extends PagedQueryDtoOptions
 */
export interface PagedFilterQueryDtoOptions extends PagedQueryDtoOptions {
  /** Filter definitions */
  filters: Record<string, FilterFieldDef>;
  /** DTO name */
  name?: string;
}

/**
 * Options for Metal CRUD DTOs.
 */
export interface MetalCrudDtoOptions {
  /** Field overrides */
  overrides?: Record<string, FieldOverride>;
  /** Response DTO options */
  response?: MetalDtoOptions;
  /** Create DTO options */
  create?: MetalDtoOptions;
  /** Replace DTO options */
  replace?: MetalDtoOptions;
  /** Update DTO options */
  update?: MetalDtoOptions;
  /** Params DTO options */
  params?: MetalDtoOptions;
  /** Fields to exclude from mutations */
  mutationExclude?: string[];
  /** Fields to include in params */
  paramsInclude?: string[];
  /** Immutable fields */
  immutable?: string[];
}

/**
 * Metal CRUD DTO decorators.
 */
export interface MetalCrudDtoDecorators {
  /** Response DTO decorator */
  response: (target: DtoConstructor) => void;
  /** Create DTO decorator */
  create: (target: DtoConstructor) => void;
  /** Replace DTO decorator */
  replace: (target: DtoConstructor) => void;
  /** Update DTO decorator */
  update: (target: DtoConstructor) => void;
  /** Params DTO decorator */
  params: (target: DtoConstructor) => void;
}

/**
 * Metal CRUD DTO class names.
 */
export type MetalCrudDtoClassNames = Partial<Record<keyof MetalCrudDtoDecorators, string>>;

/**
 * Options for Metal CRUD DTO classes.
 * @extends MetalCrudDtoOptions
 */
export interface MetalCrudDtoClassOptions extends MetalCrudDtoOptions {
  /** Base name for DTO classes */
  baseName?: string;
  /** Custom class names */
  names?: MetalCrudDtoClassNames;
}

/**
 * Metal CRUD DTO classes.
 */
export interface MetalCrudDtoClasses {
  /** Response DTO class */
  response: DtoConstructor;
  /** Create DTO class */
  create: DtoConstructor;
  /** Replace DTO class */
  replace: DtoConstructor;
  /** Update DTO class */
  update: DtoConstructor;
  /** Params DTO class */
  params: DtoConstructor;
}

/**
 * Options for nested create DTOs.
 * @extends MetalDtoOptions
 */
export interface NestedCreateDtoOptions extends MetalDtoOptions {
  /** Additional fields to exclude */
  additionalExclude?: string[];
  /** DTO name */
  name: string;
  /** Parent entity name */
  parentEntity?: string;
}

/**
 * Options for error DTOs.
 */
export interface ErrorDtoOptions {
  /** Whether to include error details */
  withDetails?: boolean;
  /** Whether to include trace ID */
  includeTraceId?: boolean;
}

/**
 * Function type for creating ORM sessions.
 */
export type CreateSessionFn = () => import("metal-orm").OrmSession;
