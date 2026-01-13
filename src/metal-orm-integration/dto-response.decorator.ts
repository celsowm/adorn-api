import { metadataStorage } from '../metadata/metadata-storage.js';

export function DtoResponse(dtoClass: any) {
  return function (
    originalMethod: Function,
    context: ClassMethodDecoratorContext & { kind: 'method' }
  ): Function | void {
    if (context.kind === 'method') {
      const methodName = String(context.name);
      const controllerClass = context.constructor;
      const routes = metadataStorage.getRoutes(controllerClass);

      const route = routes.find((r) => r.handlerName === methodName);

      if (route) {
        const dtoProperties = extractDtoProperties(dtoClass);

        route.response = {
          status: route.response?.status || 200,
          description: route.response?.description || 'Success',
          schema: {
            type: 'object',
            properties: dtoProperties,
          },
        };
      }

      return originalMethod;
    }
  };
}

function extractDtoProperties(dto: any): Record<string, any> {
  if (!dto) return {};

  const properties: Record<string, any> = {};

  if (dto.tableDef && dto.tableDef.columns) {
    Object.keys(dto.tableDef.columns).forEach((key) => {
      const column = dto.tableDef.columns[key];
      properties[key] = mapColumnTypeToOpenApi(column);
    });
  }

  return properties;
}

function mapColumnTypeToOpenApi(column: any): any {
  const colType = column.type;

  switch (colType) {
    case 'int':
    case 'integer':
      return { type: 'integer', format: 'int32' };
    case 'bigint':
      return { type: 'integer', format: 'int64' };
    case 'varchar':
    case 'text':
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    case 'decimal':
    case 'float':
    case 'double':
      return { type: 'number' };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'timestamp':
    case 'datetime':
      return { type: 'string', format: 'date-time' };
    case 'uuid':
      return { type: 'string', format: 'uuid' };
    case 'json':
      return { type: 'object' };
    case 'enum':
      return { type: 'string', enum: column.values };
    default:
      return { type: 'string' };
  }
}
