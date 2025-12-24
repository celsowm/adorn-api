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
    components: {
      schemas: {},
    },
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

        // For demo/simplicity, we'll add a basic schema for the DTO
        // In a real implementation, we'd use the AST to extract properties
        if (!openapi.components.schemas[method.dtoName]) {
          openapi.components.schemas[method.dtoName] = {
            type: 'object',
            properties: {}, // To be populated by AST scanner
          };
        }
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

function getFullPath(basePath: string, controllerPath: string, methodPath: string): string {
  const parts = [basePath, controllerPath, methodPath].filter(p => p && p !== '/');
  const fullPath = parts.map(p => p.replace(/^\/|\/$/g, '')).join('/');
  return '/' + fullPath;
}
