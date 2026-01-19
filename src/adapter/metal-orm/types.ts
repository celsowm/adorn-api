import type { ColumnDef } from "metal-orm";
import type { DtoOptions, FieldOverride } from "../../core/decorators";
import type { SchemaNode } from "../../core/schema";
import type { DtoConstructor } from "../../core/types";

export type MetalDtoMode = "response" | "create" | "update";

export interface MetalDtoOptions extends DtoOptions {
  mode?: MetalDtoMode;
  include?: string[];
  exclude?: string[];
  overrides?: Record<string, FieldOverride>;
}

export type MetalDtoTarget = Parameters<typeof import("metal-orm").getColumnMap>[0];

export interface PaginationConfig {
  defaultPageSize?: number;
  maxPageSize?: number;
}

export interface PaginationOptions {
  min?: number;
  max?: number;
  clamp?: boolean;
}

export interface ParsedPagination {
  page: number;
  pageSize: number;
}

export interface FilterFieldMapping {
  [queryKey: string]: string;
}

export interface FilterMapping {
  field: string;
  operator: "equals" | "contains" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte";
}

export interface ParseFilterOptions {
  query?: Record<string, unknown>;
  fieldMappings?: Record<string, FilterMapping>;
}

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

export interface PagedQueryDtoOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
  name?: string;
}

export interface PagedResponseDtoOptions {
  itemDto: DtoConstructor;
  description?: string;
  name?: string;
}

export interface FilterFieldDef {
  field: string;
  schema?: SchemaNode;
  operator?: "equals" | "contains" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte";
}

export interface PagedFilterQueryDtoOptions extends PagedQueryDtoOptions {
  filters: Record<string, FilterFieldDef>;
  name?: string;
}

export interface MetalCrudDtoOptions {
  overrides?: Record<string, FieldOverride>;
  response?: MetalDtoOptions;
  create?: MetalDtoOptions;
  replace?: MetalDtoOptions;
  update?: MetalDtoOptions;
  params?: MetalDtoOptions;
  mutationExclude?: string[];
  paramsInclude?: string[];
  immutable?: string[];
}

export interface MetalCrudDtoDecorators {
  response: (target: DtoConstructor) => void;
  create: (target: DtoConstructor) => void;
  replace: (target: DtoConstructor) => void;
  update: (target: DtoConstructor) => void;
  params: (target: DtoConstructor) => void;
}

export type MetalCrudDtoClassNames = Partial<Record<keyof MetalCrudDtoDecorators, string>>;

export interface MetalCrudDtoClassOptions extends MetalCrudDtoOptions {
  baseName?: string;
  names?: MetalCrudDtoClassNames;
}

export interface MetalCrudDtoClasses {
  response: DtoConstructor;
  create: DtoConstructor;
  replace: DtoConstructor;
  update: DtoConstructor;
  params: DtoConstructor;
}

export interface NestedCreateDtoOptions extends MetalDtoOptions {
  additionalExclude?: string[];
  name: string;
  parentEntity?: string;
}

export interface ErrorDtoOptions {
  withDetails?: boolean;
  includeTraceId?: boolean;
}

export type CreateSessionFn = () => import("metal-orm").OrmSession;
