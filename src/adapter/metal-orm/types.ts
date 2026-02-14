
import type {
  BelongsToReference,
  ColumnDef,
  HasManyCollection,
  HasOneReference,
  ManyToManyCollection,
  OrmSession,
  PagedResponse,
  SelectQueryBuilder,
  TableDef
} from "metal-orm";
import type { DtoOptions, ErrorResponseOptions, FieldOverride } from "../../core/decorators";
import type { SchemaNode } from "../../core/schema";
import type { DtoConstructor } from "../../core/types";
import type { RequestContext } from "../express/types";

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
  /** Whether to throw errors instead of warnings for invalid metadata (default: false) */
  strict?: boolean;
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
 * Relation quantifiers for to-many filters.
 */
export type RelationQuantifier = "some" | "every" | "none";

type ExtractManyRelationTarget<T> =
  T extends HasManyCollection<infer Child> ? Child
  : T extends ManyToManyCollection<infer Child, any> ? Child
  : never;

type ExtractOneRelationTarget<T> =
  T extends BelongsToReference<infer Child> ? Child
  : T extends HasOneReference<infer Child> ? Child
  : never;

type FilterFieldPathSegments<T> = {
  [K in keyof T & string]: ExtractManyRelationTarget<T[K]> extends never
    ? ExtractOneRelationTarget<T[K]> extends never
      ? [K]
      : [K] | [K, RelationQuantifier] | [K, RelationQuantifier, ...FilterFieldPathSegments<ExtractOneRelationTarget<T[K]>>]
    : [K]
      | [K, RelationQuantifier]
      | [K, RelationQuantifier, ...FilterFieldPathSegments<ExtractManyRelationTarget<T[K]>>]
}[keyof T & string];

/**
 * Valid filter path strings for an entity, with relation quantifiers enforced.
 */
export type FilterFieldPath<T> = {
  [K in keyof T & string]: ExtractManyRelationTarget<T[K]> extends never
    ? ExtractOneRelationTarget<T[K]> extends never
      ? K
      : K | `${K}.${RelationQuantifier}` | `${K}.${RelationQuantifier}.${FilterFieldPath<ExtractOneRelationTarget<T[K]>>}`
    : K
      | `${K}.${RelationQuantifier}`
      | `${K}.${RelationQuantifier}.${FilterFieldPath<ExtractManyRelationTarget<T[K]>>}`
}[keyof T & string];

/**
 * Valid filter path arrays for an entity, with relation quantifiers enforced.
 */
export type FilterFieldPathArray<T> = FilterFieldPathSegments<T>;

/**
 * Supported filter field input types.
 */
export type FilterFieldInput<T> = FilterFieldPath<T> | FilterFieldPathArray<T>;

/**
 * Filter mapping configuration.
 */
export interface FilterMapping<T = Record<string, unknown>> {
  /** Field name */
  field: FilterFieldInput<T>;
  /** Filter operator */
  operator: FilterOperator;
}

/**
 * Options for parsing filters.
 */
export interface ParseFilterOptions<T = Record<string, unknown>> {
  /** Query parameters */
  query?: Record<string, unknown>;
  /** Field mappings */
  fieldMappings?: Record<string, FilterMapping<T>>;
}

/**
 * Sort direction.
 */
export type SortDirection = "asc" | "desc";

/**
 * Sort parsing options.
 */
export interface ParseSortOptions<T = Record<string, unknown>> {
  /** Query parameters */
  query?: Record<string, unknown>;
  /** Allowed sortable columns */
  sortableColumns?: Record<string, FilterFieldInput<T>>;
  /** Sort field query key */
  sortByKey?: string;
  /** Sort direction query key */
  sortDirectionKey?: string;
  /** Query key for legacy sort order param (default: "sortOrder") */
  sortOrderKey?: string;
  /** Default sort field */
  defaultSortBy?: string;
  /** Default sort direction */
  defaultSortDirection?: SortDirection;
}

/**
 * Parsed sort result.
 */
export interface ParsedSort<T = Record<string, unknown>> {
  /** Requested sort key */
  sortBy?: string;
  /** Direction */
  sortDirection: SortDirection;
  /** Resolved entity field */
  field?: FilterFieldInput<T>;
}

/**
 * Sort terms accepted by metal-orm execution helpers.
 */
export type CrudListSortTerm = ColumnDef | Record<string, unknown>;

/**
 * Ready-to-use list/query configuration extracted from CRUD DTO class generation.
 * Eliminates the need for consumers to reassemble filter/sort/pagination config
 * in their service or repository layer.
 */
export interface ListConfig<T = Record<string, unknown>> {
  /** Execution-ready filter mappings for parseFilter */
  filterMappings: Record<string, FilterMapping<T>>;
  /** Execution-ready sortable column mappings for parseSort */
  sortableColumns: MetalCrudSortableColumns<T>;
  /** Default sort field key */
  defaultSortBy?: string;
  /** Default sort direction */
  defaultSortDirection: SortDirection;
  /** Default page size */
  defaultPageSize: number;
  /** Maximum page size */
  maxPageSize: number;
  /** Sort field query key */
  sortByKey: string;
  /** Sort direction query key */
  sortDirectionKey: string;
}

/**
 * Unified paged list execution options for metal-orm adapter.
 */
export interface RunPagedListOptions<
  TResult,
  TTable extends TableDef = TableDef,
  TTarget = unknown,
  TFilterTarget = Record<string, unknown>
> extends PaginationConfig {
  /** Raw request query */
  query?: Record<string, unknown>;
  /** Entity class or table used by applyFilter */
  target: TTarget;
  /** Base query builder or factory to create one */
  qb: SelectQueryBuilder<TResult, TTable> | (() => SelectQueryBuilder<TResult, TTable>);
  /** Active ORM session */
  session: OrmSession;
  /** Query key -> filter mapping */
  filterMappings: Record<string, FilterMapping<TFilterTarget>>;
  /** Query key -> field path mapping used by parseSort */
  sortableColumns: Record<string, FilterFieldInput<TFilterTarget>>;
  /** Optional explicit metal-orm sortable terms, overrides inferred table columns */
  allowedSortColumns?: Record<string, CrudListSortTerm>;
  /** Default sort field key */
  defaultSortBy?: string;
  /** Default sort direction */
  defaultSortDirection?: SortDirection;
  /** Sort field query key */
  sortByKey?: string;
  /** Sort direction query key */
  sortDirectionKey?: string;
  /** Legacy sort order query key (e.g. sortOrder=DESC) */
  sortOrderKey?: string;
  /** Optional stable tie-breaker column name */
  tieBreakerColumn?: string;
}

/**
 * Alias for runPagedList options.
 */
export type ExecuteCrudListOptions<
  TResult,
  TTable extends TableDef = TableDef,
  TTarget = unknown,
  TFilterTarget = Record<string, unknown>
> = RunPagedListOptions<TResult, TTable, TTarget, TFilterTarget>;

/**
 * Alias for runPagedList response.
 */
export type CrudPagedResponse<TResult> = PagedResponse<TResult>;

/**
 * Filter operator.
 */
export type FilterOperator =
  | "equals"
  | "not"
  | "in"
  | "notIn"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isEmpty"
  | "isNotEmpty";

/**
 * Filter type for querying.
 */
export type Filter<T, K extends keyof T> = {
  [P in K]?: {
    equals?: T[P];
    not?: T[P];
    in?: Array<T[P]>;
    notIn?: Array<T[P]>;
    contains?: T[P];
    startsWith?: T[P];
    endsWith?: T[P];
    gt?: T[P];
    gte?: T[P];
    lt?: T[P];
    lte?: T[P];
    mode?: "default" | "insensitive";
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
 * Single filter definition for CRUD query generation.
 */
export interface MetalCrudQueryFilterDef<T = Record<string, unknown>> {
  /** Field schema for query validation/OpenAPI */
  schema: SchemaNode;
  /** Entity field path mapping */
  field: FilterFieldInput<T>;
  /** Filter operator (default: equals) */
  operator?: FilterOperator;
}

/**
 * Sortable columns mapping for CRUD query generation.
 * Key is accepted `sortBy` value and value is mapped entity field path.
 */
export type MetalCrudSortableColumns<T = Record<string, unknown>> =
  Record<string, FilterFieldInput<T>>;

/**
 * Options-query generation options.
 */
export interface MetalCrudOptionsQueryOptions<T = Record<string, unknown>>
  extends PaginationConfig {
  /** Whether options query artifacts are generated (default: true) */
  enabled?: boolean;
  /** Query key used for label search (default: "search") */
  searchKey?: string;
  /** Entity field used as option label (default: "nome") */
  labelField?: keyof T & string;
  /** Entity field used as option value (default: "id") */
  valueField?: keyof T & string;
  /** Operator used for label search (default: "contains") */
  searchOperator?: FilterOperator;
}

/**
 * Query generation options for CRUD DTO factory.
 */
export interface MetalCrudQueryOptions<T = Record<string, unknown>>
  extends PaginationConfig {
  /** Filters in one place: schema + mapping + operator */
  filters?: Record<string, MetalCrudQueryFilterDef<T>>;
  /** Allowed sortBy values mapped to entity fields */
  sortableColumns?: MetalCrudSortableColumns<T>;
  /** Query key for sort field (default: "sortBy") */
  sortByKey?: string;
  /** Query key for sort direction (default: "sortDirection") */
  sortDirectionKey?: string;
  /** Default sort field key */
  defaultSortBy?: string;
  /** Default sort direction */
  defaultSortDirection?: SortDirection;
  /** Options endpoint query generation options */
  options?: MetalCrudOptionsQueryOptions<T>;
}

/**
 * Standard CRUD errors generation options.
 */
export interface MetalCrudStandardErrorsOptions {
  /** Enable generation (default: false) */
  enabled?: boolean;
  /** Reuse a specific error DTO schema */
  schema?: DtoConstructor;
  /** Generate default schema with details */
  withDetails?: boolean;
  /** Include traceId in generated schema */
  includeTraceId?: boolean;
  /** 400 invalid id error config (set false to disable) */
  invalidId?: false | ErrorResponseOptions;
  /** 404 not found error config (set false to disable) */
  notFound?: false | ErrorResponseOptions;
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
export interface MetalCrudDtoOptions<T = Record<string, unknown>> {
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
  /** Query/options/paged artifact generation */
  query?: MetalCrudQueryOptions<T>;
  /** Standard CRUD errors generation */
  errors?: boolean | MetalCrudStandardErrorsOptions;
  /** Whether to throw errors instead of warnings for invalid metadata (default: false) */
  strict?: boolean;
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
export type RouteErrorsDecorator = (
  value: unknown,
  context: ClassMethodDecoratorContext
) => void;

/**
 * Metal CRUD generated class names.
 */
export type MetalCrudDtoClassNameKey =
  keyof MetalCrudDtoDecorators
  | "queryDto"
  | "optionsQueryDto"
  | "pagedResponseDto"
  | "optionDto"
  | "optionsDto";

/**
 * Metal CRUD DTO class names.
 */
export type MetalCrudDtoClassNames = Partial<Record<MetalCrudDtoClassNameKey, string>>;

/**
 * Options for Metal CRUD DTO classes.
 * @extends MetalCrudDtoOptions
 */
export interface MetalCrudDtoClassOptions<T = Record<string, unknown>> extends MetalCrudDtoOptions<T> {
  /** Base name for DTO classes */
  baseName?: string;
  /** Custom class names */
  names?: MetalCrudDtoClassNames;
  /** Whether to throw errors instead of warnings for invalid metadata (default: false) */
  strict?: boolean;
}

/**
 * Metal CRUD DTO classes.
 */
export interface MetalCrudDtoClasses<T = Record<string, unknown>> {
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
  /** Query DTO class (paged + filters + sort) */
  queryDto: DtoConstructor;
  /** Options query DTO class */
  optionsQueryDto: DtoConstructor;
  /** Paged response DTO class for main list endpoints */
  pagedResponseDto: DtoConstructor;
  /** Option DTO class (value + label fields) */
  optionDto: DtoConstructor;
  /** Paged response DTO class for options endpoints */
  optionsDto: DtoConstructor;
  /** Prebuilt CRUD error decorator (400 invalid id, 404 not found) */
  errors?: RouteErrorsDecorator;
  /** Execution-ready filter mappings for parseFilter */
  filterMappings: Record<string, FilterMapping<T>>;
  /** Execution-ready sortable column mappings */
  sortableColumns: MetalCrudSortableColumns<T>;
  /** Ready-to-use config for list/query endpoints (combines filters, sort, pagination defaults) */
  listConfig: ListConfig<T>;
}

/**
 * Awaitable helper for CRUD service methods.
 */
export type Awaitable<T> = T | Promise<T>;

/**
 * Input for CRUD controller service: class or ready instance.
 */
export type CrudControllerServiceInput<TDtos extends MetalCrudDtoClasses<any>> =
  CrudControllerService<TDtos>
  | (new () => CrudControllerService<TDtos>);

/**
 * CRUD controller service contract used by createCrudController.
 */
export interface CrudControllerService<TDtos extends MetalCrudDtoClasses<any>> {
  list(
    ctx: RequestContext<unknown, InstanceType<TDtos["queryDto"]>>
  ): Awaitable<InstanceType<TDtos["pagedResponseDto"]>>;
  options?(
    ctx: RequestContext<unknown, InstanceType<TDtos["optionsQueryDto"]>>
  ): Awaitable<InstanceType<TDtos["optionsDto"]>>;
  getById(
    id: number,
    ctx: RequestContext<unknown, undefined, InstanceType<TDtos["params"]>>
  ): Awaitable<InstanceType<TDtos["response"]>>;
  create(
    body: InstanceType<TDtos["create"]>,
    ctx: RequestContext<InstanceType<TDtos["create"]>>
  ): Awaitable<InstanceType<TDtos["response"]>>;
  replace?(
    id: number,
    body: InstanceType<TDtos["replace"]>,
    ctx: RequestContext<
      InstanceType<TDtos["replace"]>,
      undefined,
      InstanceType<TDtos["params"]>
    >
  ): Awaitable<InstanceType<TDtos["response"]>>;
  update?(
    id: number,
    body: InstanceType<TDtos["update"]>,
    ctx: RequestContext<
      InstanceType<TDtos["update"]>,
      undefined,
      InstanceType<TDtos["params"]>
    >
  ): Awaitable<InstanceType<TDtos["response"]>>;
  delete?(
    id: number,
    ctx: RequestContext<unknown, undefined, InstanceType<TDtos["params"]>>
  ): Awaitable<void>;
}

/**
 * createCrudController options.
 */
export interface CreateCrudControllerOptions<
  TDtos extends MetalCrudDtoClasses<any>
> {
  /** Controller path. */
  path: string;
  /** Service instance or class (new () => service). */
  service: CrudControllerServiceInput<TDtos>;
  /** DTO bundle produced by createMetalCrudDtoClasses. */
  dtos: TDtos;
  /** Entity label used by parseIdOrThrow messages. */
  entityName: string;
  /** Generate GET /options route (default: true). */
  withOptionsRoute?: boolean;
  /** Generate PUT /:id route (default: true). */
  withReplace?: boolean;
  /** Generate PATCH /:id route (default: true). */
  withPatch?: boolean;
  /** Generate DELETE /:id route (default: true). */
  withDelete?: boolean;
  /** Optional OpenAPI tags for generated controller. */
  tags?: string[];
}

/**
 * Metal Tree DTO class names.
 */
export interface MetalTreeDtoClassNames {
  /** Entity DTO class name */
  entity?: string;
  /** Tree node DTO class name */
  node?: string;
  /** Tree node result DTO class name */
  nodeResult?: string;
  /** Threaded tree node DTO class name */
  threadedNode?: string;
  /** Tree list entry DTO class name */
  treeListEntry?: string;
}

/**
 * Options for tree list entry DTOs.
 */
export interface MetalTreeListEntryOptions {
  /** Schema for list entry key */
  keySchema?: SchemaNode;
  /** Schema for list entry value */
  valueSchema?: SchemaNode;
}

/**
 * Options for Metal Tree DTO classes.
 */
export interface MetalTreeDtoClassOptions {
  /** Base name for DTO classes */
  baseName?: string;
  /** Custom class names */
  names?: MetalTreeDtoClassNames;
  /** Reuse an existing entity DTO class */
  entityDto?: DtoConstructor;
  /** Options for generated entity DTO when entityDto is not provided */
  entity?: MetalDtoOptions;
  /** Whether to include depth metadata (default: true) */
  includeTreeMetadata?: boolean;
  /** Override the parent key column name */
  parentKey?: string;
  /** Tree list entry options */
  treeListEntry?: MetalTreeListEntryOptions;
}

/**
 * Metal Tree DTO classes.
 */
export interface MetalTreeDtoClasses {
  /** Entity DTO class */
  entity: DtoConstructor;
  /** Tree node DTO class */
  node: DtoConstructor;
  /** Tree node result DTO class */
  nodeResult: DtoConstructor;
  /** Threaded tree node DTO class */
  threadedNode: DtoConstructor;
  /** Tree list entry DTO class */
  treeListEntry: DtoConstructor;
  /** Tree list schema */
  treeListSchema: SchemaNode;
  /** Threaded tree schema */
  threadedTreeSchema: SchemaNode;
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
