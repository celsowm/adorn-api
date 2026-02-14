import type { ErrorResponseOptions, FieldOverride } from "../../core/decorators";
import { Errors } from "../../core/decorators";
import { registerDto, type FieldMeta } from "../../core/metadata";
import { t } from "../../core/schema";
import type { DtoConstructor } from "../../core/types";
import { MetalDto } from "./dto";
import { createErrorDtoClass } from "./error-dtos";
import { createPagedResponseDtoClass } from "./paged-dtos";
import type {
  FilterMapping,
  MetalCrudDtoClassNameKey,
  MetalCrudDtoClassOptions,
  MetalCrudDtoClasses,
  MetalCrudDtoDecorators,
  MetalCrudDtoOptions,
  MetalCrudQueryFilterDef,
  MetalCrudSortableColumns,
  MetalCrudStandardErrorsOptions,
  MetalDtoOptions,
  MetalDtoTarget,
  NestedCreateDtoOptions,
  RouteErrorsDecorator,
  SortDirection
} from "./types";

export function createMetalCrudDtos<TEntity extends Record<string, unknown>>(
  target: MetalDtoTarget,
  options: MetalCrudDtoOptions<TEntity> = {}
): MetalCrudDtoDecorators {
  const mutationExclude = options.mutationExclude;
  const immutable = options.immutable;
  const strict = options.strict ?? false;

  const response = buildCrudOptions(options.response, options.overrides, { strict });
  const create = buildCrudOptions(options.create, options.overrides, {
    mode: "create",
    exclude: mergeStringArrays(mutationExclude, options.create?.exclude),
    strict
  });
  const replace = buildCrudOptions(options.replace, options.overrides, {
    mode: "create",
    exclude: mergeStringArrays(mutationExclude, immutable, options.replace?.exclude),
    strict
  });
  const update = buildCrudOptions(options.update, options.overrides, {
    mode: "update",
    exclude: mergeStringArrays(mutationExclude, immutable, options.update?.exclude),
    strict
  });

  const params = buildCrudOptions(options.params, options.overrides, { strict });
  params.include = params.include ?? options.paramsInclude ?? ["id"];

  return {
    response: MetalDto(target, response),
    create: MetalDto(target, create),
    replace: MetalDto(target, replace),
    update: MetalDto(target, update),
    params: MetalDto(target, params)
  };
}

export function createMetalCrudDtoClasses<TEntity extends Record<string, unknown>>(
  target: MetalDtoTarget,
  options: MetalCrudDtoClassOptions<TEntity> = {}
): MetalCrudDtoClasses<TEntity> {
  const { baseName, names, query, errors: errorOptions, ...crudOptions } = options;
  const decorators = createMetalCrudDtos(target, crudOptions);
  const entityName = baseName ?? getTargetName(target);

  const defaultNames: Record<MetalCrudDtoClassNameKey, string> = {
    response: `${entityName}Dto`,
    create: `Create${entityName}Dto`,
    replace: `Replace${entityName}Dto`,
    update: `Update${entityName}Dto`,
    params: `${entityName}ParamsDto`,
    queryDto: `${entityName}QueryDto`,
    optionsQueryDto: `${entityName}OptionsQueryDto`,
    pagedResponseDto: `${entityName}PagedResponseDto`,
    optionDto: `${entityName}OptionDto`,
    optionsDto: `${entityName}OptionsDto`
  };

  const crudClasses: Partial<MetalCrudDtoClasses<TEntity>> = {};
  for (const key of Object.keys(decorators) as Array<keyof MetalCrudDtoDecorators>) {
    const name = names?.[key] ?? defaultNames[key];
    crudClasses[key] = buildDtoClass(name, decorators[key]);
  }

  const strict = options.strict ?? false;
  const queryOptions = query ?? {};
  const sortByKey = queryOptions.sortByKey ?? "sortBy";
  const sortDirectionKey = queryOptions.sortDirectionKey ?? "sortDirection";
  const defaultPageSize = queryOptions.defaultPageSize ?? 25;
  const maxPageSize = queryOptions.maxPageSize ?? 100;
  const filters = queryOptions.filters ?? {};
  const sortableColumns = cloneSortableColumns(queryOptions.sortableColumns ?? {});
  const filterMappings = buildFilterMappings(filters);

  const optionsQueryConfig = queryOptions.options ?? {};
  const optionsEnabled = optionsQueryConfig.enabled ?? true;
  const optionsSearchKey = optionsQueryConfig.searchKey ?? "search";
  const optionsLabelField = (optionsQueryConfig.labelField ?? "nome") as keyof TEntity & string;
  const optionsValueField = (optionsQueryConfig.valueField ?? "id") as keyof TEntity & string;
  const optionsSearchOperator = optionsQueryConfig.searchOperator ?? "contains";
  const optionsDefaultPageSize = optionsQueryConfig.defaultPageSize ?? defaultPageSize;
  const optionsMaxPageSize = optionsQueryConfig.maxPageSize ?? maxPageSize;

  if (optionsEnabled && !(optionsSearchKey in filterMappings)) {
    filterMappings[optionsSearchKey] = {
      field: optionsLabelField,
      operator: optionsSearchOperator
    };
  }

  const queryDtoName = names?.queryDto ?? defaultNames.queryDto;
  const optionsQueryDtoName = names?.optionsQueryDto ?? defaultNames.optionsQueryDto;
  const pagedResponseDtoName = names?.pagedResponseDto ?? defaultNames.pagedResponseDto;
  const optionDtoName = names?.optionDto ?? defaultNames.optionDto;
  const optionsDtoName = names?.optionsDto ?? defaultNames.optionsDto;

  const queryDto = createQueryDtoClass({
    name: queryDtoName,
    filters,
    sortableColumns,
    sortByKey,
    sortDirectionKey,
    defaultSortBy: queryOptions.defaultSortBy,
    defaultSortDirection: queryOptions.defaultSortDirection ?? "asc",
    defaultPageSize,
    maxPageSize
  });

  const optionsQueryDto = createOptionsQueryDtoClass({
    name: optionsQueryDtoName,
    filters,
    sortableColumns,
    sortByKey,
    sortDirectionKey,
    defaultSortBy: queryOptions.defaultSortBy,
    defaultSortDirection: queryOptions.defaultSortDirection ?? "asc",
    defaultPageSize: optionsDefaultPageSize,
    maxPageSize: optionsMaxPageSize,
    searchKey: optionsEnabled ? optionsSearchKey : undefined
  });

  const optionDto = buildDtoClass(
    optionDtoName,
    MetalDto(target, {
      include: Array.from(new Set([optionsValueField, optionsLabelField])),
      strict
    })
  );

  const responseDto = crudClasses.response as DtoConstructor;
  const pagedResponseDto = createPagedResponseDtoClass({
    name: pagedResponseDtoName,
    itemDto: responseDto,
    description: `Paged ${entityName} response.`
  });
  const optionsDto = createPagedResponseDtoClass({
    name: optionsDtoName,
    itemDto: optionDto,
    description: `${entityName} options response.`
  });

  const errors = buildStandardCrudErrors(entityName, errorOptions);

  const listConfig = {
    filterMappings,
    sortableColumns,
    defaultSortBy: queryOptions.defaultSortBy,
    defaultSortDirection: queryOptions.defaultSortDirection ?? "asc" as SortDirection,
    defaultPageSize,
    maxPageSize,
    sortByKey,
    sortDirectionKey
  };

  return {
    response: crudClasses.response as DtoConstructor,
    create: crudClasses.create as DtoConstructor,
    replace: crudClasses.replace as DtoConstructor,
    update: crudClasses.update as DtoConstructor,
    params: crudClasses.params as DtoConstructor,
    queryDto,
    optionsQueryDto,
    pagedResponseDto,
    optionDto,
    optionsDto,
    errors,
    filterMappings,
    sortableColumns,
    listConfig
  };
}

export function createNestedCreateDtoClass(
  target: MetalDtoTarget,
  overrides: Record<string, FieldOverride>,
  options: NestedCreateDtoOptions
): DtoConstructor {
  const { additionalExclude, name, parentEntity: _parentEntity, ...metalDtoOptions } = options;

  const allExcludes = mergeStringArrays(
    ["id", "createdAt"],
    additionalExclude,
    metalDtoOptions.exclude
  );

  @MetalDto(target, {
    ...metalDtoOptions,
    mode: "create",
    exclude: allExcludes,
    overrides
  })
  class NestedCreateDto {}

  Object.defineProperty(NestedCreateDto, "name", { value: name, configurable: true });

  return NestedCreateDto;
}

interface CreateQueryDtoClassOptions<TEntity extends Record<string, unknown>> {
  name: string;
  filters: Record<string, MetalCrudQueryFilterDef<TEntity>>;
  sortableColumns: MetalCrudSortableColumns<TEntity>;
  sortByKey: string;
  sortDirectionKey: string;
  defaultSortBy?: string;
  defaultSortDirection: SortDirection;
  defaultPageSize: number;
  maxPageSize: number;
}

interface CreateOptionsQueryDtoClassOptions<TEntity extends Record<string, unknown>>
  extends CreateQueryDtoClassOptions<TEntity> {
  searchKey?: string;
}

function createQueryDtoClass<TEntity extends Record<string, unknown>>(
  options: CreateQueryDtoClassOptions<TEntity>
): DtoConstructor {
  const fields = buildQueryFields(options);
  return createRegisteredDtoClass(options.name, fields);
}

function createOptionsQueryDtoClass<TEntity extends Record<string, unknown>>(
  options: CreateOptionsQueryDtoClassOptions<TEntity>
): DtoConstructor {
  const fields = buildQueryFields(options);
  if (options.searchKey) {
    fields[options.searchKey] = {
      schema: t.optional(t.string({ minLength: 1 })),
      optional: true
    };
  }
  return createRegisteredDtoClass(options.name, fields);
}

function buildQueryFields<TEntity extends Record<string, unknown>>(
  options: CreateQueryDtoClassOptions<TEntity>
): Record<string, FieldMeta> {
  const fields: Record<string, FieldMeta> = {
    page: {
      schema: t.optional(t.integer({ minimum: 1, default: 1 })),
      optional: true
    },
    pageSize: {
      schema: t.optional(
        t.integer({
          minimum: 1,
          maximum: options.maxPageSize,
          default: options.defaultPageSize
        })
      ),
      optional: true
    }
  };

  for (const [queryKey, def] of Object.entries(options.filters)) {
    fields[queryKey] = { schema: t.optional(def.schema), optional: true };
  }

  const sortableKeys = Object.keys(options.sortableColumns);
  if (sortableKeys.length > 0) {
    const sortByOptions = options.defaultSortBy
      ? { default: options.defaultSortBy }
      : {};
    fields[options.sortByKey] = {
      schema: t.optional(t.enum(sortableKeys, sortByOptions)),
      optional: true
    };
    fields[options.sortDirectionKey] = {
      schema: t.optional(
        t.enum(["asc", "desc"], { default: options.defaultSortDirection })
      ),
      optional: true
    };
  }

  return fields;
}

function createRegisteredDtoClass(
  name: string,
  fields: Record<string, FieldMeta>
): DtoConstructor {
  const DtoClass = class {};
  Object.defineProperty(DtoClass, "name", { value: name, configurable: true });
  registerDto(DtoClass, { name, fields });
  return DtoClass as DtoConstructor;
}

function buildFilterMappings<TEntity extends Record<string, unknown>>(
  filters: Record<string, MetalCrudQueryFilterDef<TEntity>>
): Record<string, FilterMapping<TEntity>> {
  const mappings: Record<string, FilterMapping<TEntity>> = {};
  for (const [queryKey, def] of Object.entries(filters)) {
    mappings[queryKey] = {
      field: def.field,
      operator: def.operator ?? "equals"
    };
  }
  return mappings;
}

function cloneSortableColumns<TEntity extends Record<string, unknown>>(
  sortableColumns: MetalCrudSortableColumns<TEntity>
): MetalCrudSortableColumns<TEntity> {
  return Object.fromEntries(
    Object.entries(sortableColumns).map(([key, value]) => [key, value])
  ) as MetalCrudSortableColumns<TEntity>;
}

function buildStandardCrudErrors(
  entityName: string,
  options: boolean | MetalCrudStandardErrorsOptions | undefined
): RouteErrorsDecorator | undefined {
  if (!options) {
    return undefined;
  }

  const config: MetalCrudStandardErrorsOptions =
    typeof options === "boolean" ? {} : options;
  if (config.enabled === false) {
    return undefined;
  }

  const responses: ErrorResponseOptions[] = [];
  const invalidId = config.invalidId;
  const notFound = config.notFound;

  if (invalidId !== false) {
    responses.push({
      status: 400,
      description: invalidId?.description ?? `Invalid ${entityName} id.`,
      contentType: invalidId?.contentType
    });
  }
  if (notFound !== false) {
    responses.push({
      status: 404,
      description: notFound?.description ?? `${entityName} not found.`,
      contentType: notFound?.contentType
    });
  }

  if (!responses.length) {
    return undefined;
  }

  const schema = config.schema ?? createErrorDtoClass({
    withDetails: config.withDetails ?? false,
    includeTraceId: config.includeTraceId ?? true
  });
  return Errors(schema, responses);
}

function buildDtoClass(name: string, decorator: (target: DtoConstructor) => void): DtoConstructor {
  const DtoClass = class {};
  Object.defineProperty(DtoClass, "name", { value: name, configurable: true });
  decorator(DtoClass);
  return DtoClass as DtoConstructor;
}

function getTargetName(target: unknown): string {
  if (typeof target === "function" && target.name) {
    return target.name;
  }
  return "Entity";
}

function mergeOverrides(
  base?: Record<string, FieldOverride>,
  override?: Record<string, FieldOverride>
): Record<string, FieldOverride> | undefined {
  if (!base && !override) {
    return undefined;
  }
  return { ...(base ?? {}), ...(override ?? {}) };
}

function mergeStringArrays(
  ...entries: Array<string[] | undefined>
): string[] | undefined {
  const merged = new Set<string>();
  for (const entry of entries) {
    for (const value of entry ?? []) {
      merged.add(value);
    }
  }
  return merged.size ? Array.from(merged) : undefined;
}

function buildCrudOptions(
  base: MetalDtoOptions | undefined,
  overrides: Record<string, FieldOverride> | undefined,
  extra: Partial<MetalDtoOptions> = {}
): MetalDtoOptions {
  const mergedOverrides = mergeOverrides(overrides, base?.overrides);
  const output: MetalDtoOptions = { ...(base ?? {}), ...extra };
  if (mergedOverrides) {
    output.overrides = mergedOverrides;
  }
  return output;
}
