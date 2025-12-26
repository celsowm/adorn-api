import {
  EmptyQuery,
  type InferSchema,
  type SchemaRef,
  type SchemaTypeMap,
} from '../../core/schema.js';
import type { TypedRequestContext } from '../../core/express.js';
import type { EntitySchemaShapes } from './schema-builder.js';
import type { SchemaProvider } from './schema-provider.js';

type EntityApiTypeHints = Partial<{
  params: unknown;
  response: unknown;
  list: unknown;
  count: { count: number };
  create: unknown;
  update: unknown;
  search: unknown;
}>;

type ResolveType<TTypes, K extends keyof EntityApiTypeHints, TFallback> =
  K extends keyof TTypes ? TTypes[K] : TFallback;

type ResponseType<TTypes extends EntityApiTypeHints> = ResolveType<TTypes, 'response', unknown>;
type ListType<TTypes extends EntityApiTypeHints> =
  ResolveType<TTypes, 'list', Array<ResponseType<TTypes>>>;

export type EntityApiRefs<
  TTypes extends EntityApiTypeHints = {},
  TExtras extends Record<string, SchemaRef> = {},
> = {
  params: SchemaRef<ResolveType<TTypes, 'params', unknown>>;
  response: SchemaRef<ResponseType<TTypes>>;
  list: SchemaRef<ListType<TTypes>>;
  count: SchemaRef<ResolveType<TTypes, 'count', { count: number }>>;
  create: SchemaRef<ResolveType<TTypes, 'create', unknown>>;
  update: SchemaRef<ResolveType<TTypes, 'update', unknown>>;
  search: SchemaRef<ResolveType<TTypes, 'search', unknown>>;
  emptyQuery: typeof EmptyQuery;
} & TExtras;

export type EntityApiOptions<
  TSchema,
  TShapes extends EntitySchemaShapes<TSchema>,
  TExtras extends Record<string, SchemaRef> = {},
> = {
  baseId: string;
  provider: SchemaProvider<TSchema>;
  shapes: TShapes;
  extras?: TExtras;
  schemaId?: (suffix: string) => string;
};

type StandardEntityRefs = {
  params: SchemaRef;
  response: SchemaRef;
  list: SchemaRef;
  count: SchemaRef;
  create: SchemaRef;
  update: SchemaRef;
  search: SchemaRef;
  emptyQuery: SchemaRef;
};

export type InferApiTypes<
  TRefs extends StandardEntityRefs & Record<string, SchemaRef>,
> = {
  DTO: SchemaTypeMap<TRefs>;
  Context: {
    Get: TypedRequestContext<
      InferSchema<TRefs['params']>,
      InferSchema<TRefs['emptyQuery']>,
      undefined
    >;
    List: TypedRequestContext<{}, InferSchema<TRefs['emptyQuery']>, undefined>;
    Count: TypedRequestContext<{}, InferSchema<TRefs['emptyQuery']>, undefined>;
    Search: TypedRequestContext<{}, InferSchema<TRefs['search']>, undefined>;
    Create: TypedRequestContext<
      {},
      InferSchema<TRefs['emptyQuery']>,
      InferSchema<TRefs['create']>
    >;
    Update: TypedRequestContext<
      InferSchema<TRefs['params']>,
      InferSchema<TRefs['emptyQuery']>,
      InferSchema<TRefs['update']>
    >;
    Remove: TypedRequestContext<
      InferSchema<TRefs['params']>,
      InferSchema<TRefs['emptyQuery']>,
      undefined
    >;
  };
};

export function defineEntityApi<
  TSchema = unknown,
  TShapes extends EntitySchemaShapes<TSchema> = EntitySchemaShapes<TSchema>,
  TExtras extends Record<string, SchemaRef> = {},
  TTypes extends EntityApiTypeHints = {},
>(
  options: EntityApiOptions<TSchema, TShapes, TExtras> & { types?: TTypes },
): EntityApiRefs<TTypes, TExtras> {
  const { baseId, provider, shapes, extras } = options;
  const schemaId = options.schemaId ?? ((suffix: string) => `${baseId}${suffix}`);

  const paramsSchema = provider.object(shapes.params);
  const responseSchema = provider.object(shapes.response);
  const createSchema = provider.object(shapes.create);
  const updateSchema = provider.object(shapes.update);
  const searchSchema = provider.object(shapes.search);

  const countSchema = provider.int ? provider.int(provider.number()) : provider.number();

  const paramsRef = provider.toSchemaRef(schemaId('Params'), paramsSchema);
  const responseRef = provider.toSchemaRef(schemaId('Response'), responseSchema);
  const listRef = provider.toSchemaRef(schemaId('ListResponse'), provider.array(responseSchema));
  const countRef = provider.toSchemaRef(
    schemaId('CountResponse'),
    provider.object({ count: countSchema }),
  );
  const createRef = provider.toSchemaRef(schemaId('CreateBody'), createSchema);
  const updateRef = provider.toSchemaRef(schemaId('UpdateBody'), updateSchema);
  const searchRef = provider.toSchemaRef(schemaId('SearchQuery'), searchSchema);

  const refs = {
    params: paramsRef as SchemaRef<ResolveType<TTypes, 'params', unknown>>,
    response: responseRef as SchemaRef<ResponseType<TTypes>>,
    list: listRef as SchemaRef<ListType<TTypes>>,
    count: countRef as SchemaRef<ResolveType<TTypes, 'count', { count: number }>>,
    create: createRef as SchemaRef<ResolveType<TTypes, 'create', unknown>>,
    update: updateRef as SchemaRef<ResolveType<TTypes, 'update', unknown>>,
    search: searchRef as SchemaRef<ResolveType<TTypes, 'search', unknown>>,
    emptyQuery: EmptyQuery,
    ...(extras ?? {}),
  };

  return refs as EntityApiRefs<TTypes, TExtras>;
}
