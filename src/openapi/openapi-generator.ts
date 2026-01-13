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

    const sortedParams = [...parameters].sort((a, b) => a.index - b.index);

    return sortedParams.map((param) => ({
      name: param.name,
      in: param.type,
      required: param.required ?? param.type === 'param',
      schema: this.getParameterSchema(param.type),
    }));
  }

  private getParameterSchema(type: ParameterMetadata['type']): any {
    switch (type) {
      case 'param':
        return { type: 'string' };
      case 'query':
        return { type: 'string' };
      case 'body':
        return { type: 'object' };
      case 'header':
        return { type: 'string' };
      default:
        return { type: 'string' };
    }
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
