/**
 * Emit OpenAPI JSON specification
 */

import type { Config } from '../config/types.js';
import type { ControllerInfo } from '../ast/scanControllers.js';

export function emitOpenapiJson(config: Config, controllers: ControllerInfo[]): Record<string, any> {
  const openapi: Record<string, any> = {
    openapi: '3.1.0',
    info: config.swagger.info,
    paths: {},
  };

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
                schema: {
                  type: 'object',
                },
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
        operation.parameters = method.pathParams.map(param => ({
          name: param,
          in: 'path',
          required: true,
          schema: {
            type: 'string',
          },
        }));
      }

      openapi.paths[fullPath][method.httpMethod] = operation;
    }
  }

  return openapi;
}

function getFullPath(basePath: string, controllerPath: string, methodPath: string): string {
  const parts = [basePath, controllerPath, methodPath].filter(p => p && p !== '/');
  const fullPath = parts.map(p => p.replace(/^\/|\/$/g, '')).join('/');
  return '/' + fullPath;
}
