/**
 * Emit OpenAPI JSON specification
 */

import type { Config } from '../config/types.js';
import type { ControllerInfo } from '../ast/scanControllers.js';
import type { DtoInfo } from '../ast/scanDtos.js';

export function emitOpenapiJson(
  config: Config,
  controllers: ControllerInfo[],
  dtos: DtoInfo[] = []
): Record<string, any> {
  const openapi: Record<string, any> = {
    openapi: '3.1.0',
    info: config.swagger.info,
    paths: {},
    components: {
      schemas: {},
    },
  };

  // Build schemas from DTOs
  for (const dto of dtos) {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const prop of dto.properties) {
      properties[prop.name] = mapTypeToOpenApi(prop.type, prop.isArray);
      if (prop.required) {
        required.push(prop.name);
      }
    }

    openapi.components.schemas[dto.name] = {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  // Build paths from controllers
  for (const controller of controllers) {
    for (const method of controller.methods) {
      const fullPath = getFullPath(config.generation.basePath, controller.path, method.path);
      
      if (!openapi.paths[fullPath]) {
        openapi.paths[fullPath] = {};
      }

      const operation: Record<string, any> = {
        operationId: `${controller.className.toLowerCase()}_${method.methodName}`,
        responses: {
          [method.statusCode || 200]: {
            description: 'Success',
            content: {
              'application/json': {
                schema: method.dtoName 
                  ? { $ref: `#/components/schemas/${method.dtoName}` }
                  : { type: 'object' },
              },
            },
          },
        },
      };

      // Add request body for POST, PUT, PATCH
      if (['post', 'put', 'patch'].includes(method.httpMethod) && method.dtoName) {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: `#/components/schemas/${method.dtoName}`,
              },
            },
          },
        };
      }

      // Add path parameters if any
      if (method.pathParams && method.pathParams.length > 0) {
        const parameters = method.pathParams.map(param => ({
          name: param,
          in: 'path',
          required: true,
          schema: {
            type: 'string', // Default to string
          },
        }));

        if (!operation.parameters) {
          operation.parameters = [];
        }
        operation.parameters.push(...parameters);
      }

      openapi.paths[fullPath][method.httpMethod] = operation;
    }
  }

  return openapi;
}

function mapTypeToOpenApi(tsType: string, isArray: boolean): any {
  let type: string;
  let format: string | undefined;

  const normalizedType = tsType.toLowerCase();

  if (normalizedType === 'string') {
    type = 'string';
  } else if (normalizedType === 'number') {
    type = 'number';
  } else if (normalizedType === 'boolean') {
    type = 'boolean';
  } else if (normalizedType === 'date' || normalizedType.includes('date')) {
    type = 'string';
    format = 'date-time';
  } else {
    type = 'object';
  }

  const schema: any = { type };
  if (format) {
    schema.format = format;
  }

  if (isArray) {
    return {
      type: 'array',
      items: schema,
    };
  }

  return schema;
}

function getFullPath(basePath: string, controllerPath: string, methodPath: string): string {
  const parts = [basePath, controllerPath, methodPath].filter(p => p && p !== '/');
  const fullPath = parts.map(p => p.replace(/^\/|\/$/g, '')).join('/');
  return '/' + fullPath;
}
