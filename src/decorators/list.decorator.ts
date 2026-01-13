import { metadataStorage } from "../metadata/metadata-storage.js";
import { dtoToOpenApiSchema, getTableDefFromEntity } from "metal-orm";
import { SchemaModifier } from "../metal-orm-integration/schema-modifier.js";
import type { RouteMetadata } from "../types/metadata.js";

type ListOptions = {
  entity?: any;
  schema?: any;
  includeRelations?: string[];
  relationsDepth?: number;
};

const pendingRoutes = new Map<Function, RouteMetadata>();

export function attachPendingListRoutesToController(
  controllerClass: Function,
): void {
  pendingRoutes.forEach((route, method) => {
    pendingRoutes.delete(method);
    metadataStorage.addRoute(controllerClass, route);
  });
}

function parseListOptions(
  pathOrOptions?: string | ListOptions,
  options?: ListOptions,
): { path: string; options: ListOptions | undefined } {
  let path = "";

  if (typeof pathOrOptions === "string") {
    path = pathOrOptions;
  }

  return { path, options };
}

export function List(
  pathOrOptions?: string | ListOptions,
  options?: ListOptions,
) {
  return function (
    _originalMethod: Function,
    _context: ClassMethodDecoratorContext,
  ): void {
    if (_context.kind !== "method") return;

    const methodName = String(_context.name);
    const parsed = parseListOptions(pathOrOptions, options);

    let schema: any;

    if (parsed.options?.entity) {
      const tableDef = getTableDefFromEntity(parsed.options.entity);
      if (tableDef) {
        schema = dtoToOpenApiSchema(tableDef);
      }
    } else if (parsed.options?.schema) {
      if (parsed.options.schema instanceof SchemaModifier) {
        schema = parsed.options.schema.toOpenApi();
      } else {
        schema = parsed.options.schema;
      }
    }

    const route: RouteMetadata = {
      path: parsed.path,
      method: "GET",
      handlerName: methodName,
      middlewares: [],
      guards: [],
      parameters: [],
      entity: parsed.options?.entity,
      schema,
      isArray: true,
      includeRelations: parsed.options?.includeRelations,
      relationsDepth: parsed.options?.relationsDepth,
    };

    pendingRoutes.set(_originalMethod, route);
  };
}

export function createListHelper(entity: any) {
  return {
    omit: (...fields: string[]) => new SchemaModifier(entity).omit(...fields),
    only: (...fields: string[]) => new SchemaModifier(entity).only(...fields),
    include: (...relations: string[]) => {
      const modifier = new SchemaModifier(entity);
      const schema = modifier.toOpenApi();
      if (!schema.properties) return schema;
      schema.properties = {
        ...schema.properties,
        ...Object.fromEntries(
          relations.map((rel) => [
            rel,
            {
              type: "array",
              items: {
                $ref: `#/components/schemas/${rel.charAt(0).toUpperCase() + rel.slice(1)}`,
              },
            },
          ]),
        ),
      };
      return schema;
    },
    addComputed: (name: string, valueSchema: any) =>
      new SchemaModifier(entity).addComputed(name, valueSchema),
    rename: (mapping: Record<string, string>) =>
      new SchemaModifier(entity).rename(mapping),
  };
}
