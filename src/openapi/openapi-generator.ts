import type { OpenApiSpec, OpenApiOptions } from '../types/openapi.js';
import type { RouteMetadata, ParameterMetadata } from '../types/metadata.js';
import { metadataStorage } from '../metadata/metadata-storage.js';

export class OpenApiGenerator {
  generateDocument(options: OpenApiOptions): OpenApiSpec {
    const controllers = metadataStorage.getAllControllers();
    const paths: Record<string, any> = {};

    controllers.forEach((controller) => {
      const controllerMeta = metadataStorage.getController(controller);
      const routes = metadataStorage.getRoutes(controller);

      routes.forEach((route) => {
        const fullPath = `${controllerMeta?.path || ''}${route.path}`;
        const normalizedPath = this.normalizePath(fullPath);

        if (!paths[normalizedPath]) {
          paths[normalizedPath] = {};
        }

        const operation = this.generateOperation(route);
        paths[normalizedPath][route.method.toLowerCase()] = operation;
      });
    });

    const spec: OpenApiSpec = {
      openapi: '3.1.0',
      info: {
        title: options.info.title,
        version: options.info.version,
        description: options.info.description,
      },
      paths,
      tags: options.tags || [],
      servers: options.servers || [],
      components: options.components || {},
    };

    return spec;
  }

  private normalizePath(path: string): string {
    return path.replace(/:([^/]+)/g, '{$1}');
  }

  private generateOperation(route: RouteMetadata): any {
    const operation: any = {
      summary: route.summary,
      description: route.description,
      tags: route.tags || [],
      parameters: this.generateParameters(route.parameters),
      responses: this.generateResponses(route),
    };

    return operation;
  }

  private generateParameters(parameters?: ParameterMetadata[]): any[] {
    if (!parameters || parameters.length === 0) {
      return [];
    }

    const oaiParameters: any[] = [];
    const sortedParams = [...parameters].sort((a, b) => a.index - b.index);

    sortedParams.forEach((param) => {
      // Body is handled via requestBody in OpenAPI
      if (param.type === 'body') return;

      if (param.type === 'params' || param.type === 'query') {
        const location = param.type === 'params' ? 'path' : 'query';

        // If it's a schema-based object, we should ideally expand it
        // For now, let's handle the common case of simple naming
        if (param.schema && typeof param.schema.shape === 'object') {
          const shape = param.schema.shape;
          Object.keys(shape).forEach(key => {
            oaiParameters.push({
              name: key,
              in: location,
              required: true, // Path params are always required
              schema: { type: 'string' } // Simplified
            });
          });
        } else {
          oaiParameters.push({
            name: param.name === 'params' ? 'id' : param.name, // Heuristic for now
            in: location,
            required: param.required ?? true,
            schema: { type: 'string' },
          });
        }
      } else if (param.type === 'combined') {
        // Combined is more complex, skip for now or expand if possible
      }
    });

    return oaiParameters;
  }

  private generateResponses(route: RouteMetadata): any {
    const responses: any = {};

    if (route.response) {
      responses[route.response.status] = {
        description: route.response.description || 'Success',
        content: route.response.schema
          ? {
            'application/json': {
              schema: route.response.schema,
            },
          }
          : undefined,
      };
    } else {
      responses[200] = {
        description: 'Success',
      };
    }

    return responses;
  }
}
