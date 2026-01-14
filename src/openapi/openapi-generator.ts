import type { OpenApiSpec, OpenApiOptions } from "../types/openapi.js";
import type { RouteMetadata, ParameterMetadata } from "../types/metadata.js";
import { metadataStorage } from "../metadata/metadata-storage.js";
import { dtoToOpenApiSchema, getTableDefFromEntity } from "metal-orm";
import { SchemaModifier } from "../metal-orm-integration/schema-modifier.js";
import { zodToOpenApi, isOptional } from "./zod-to-openapi.js";

class SchemaRegistry {
  private schemas: Map<string, any> = new Map();

  register(name: string, schema: any): string {
    const schemaKey = this.getSchemaKey(schema);
    if (!this.schemas.has(schemaKey)) {
      this.schemas.set(schemaKey, { name, schema });
    }
    return `#/components/schemas/${name}`;
  }

  private getSchemaKey(schema: any): string {
    return JSON.stringify(schema);
  }

  getComponents(): any {
    const components: any = { schemas: {} };
    this.schemas.forEach((value) => {
      components.schemas[value.name] = value.schema;
    });
    return components;
  }

  getErrorSchema(): any {
    return {
      type: "object",
      required: ["error"],
      properties: {
        error: { type: "string" },
      },
    };
  }

  getValidationErrorSchema(): any {
    return {
      type: "object",
      required: ["error"],
      properties: {
        error: { type: "string" },
        details: { type: "object" },
      },
    };
  }
}

export class OpenApiGenerator {
  private schemaRegistry: SchemaRegistry;

  constructor() {
    this.schemaRegistry = new SchemaRegistry();
  }

  generateDocument(options: OpenApiOptions): OpenApiSpec {
    const controllers = metadataStorage.getAllControllers();
    const paths: Record<string, any> = {};
    const tags: any[] = [];

    controllers.forEach((controller) => {
      const controllerMeta = metadataStorage.getController(controller);
      const routes = metadataStorage.getRoutes(controller);
      const tagName = this.getTagNameFromPath(controllerMeta?.path || "");

      if (controllerMeta?.path && !tags.find((t) => t.name === tagName)) {
        tags.push({
          name: tagName,
          description: `${tagName.charAt(0).toUpperCase() + tagName.slice(1)} endpoints`,
        });
      }

      routes.forEach((route) => {
        const fullPath = `${controllerMeta?.path || ""}${route.path}`;
        const normalizedPath = this.normalizePath(fullPath);

        if (!paths[normalizedPath]) {
          paths[normalizedPath] = {};
        }

        const operation = this.generateOperation(
          route,
          controllerMeta?.path,
          tagName,
        );
        paths[normalizedPath][route.method.toLowerCase()] = operation;
      });
    });

    const generatedComponents = this.schemaRegistry.getComponents();
    const userComponents = options.components || {};
    const mergedComponents = {
      ...userComponents,
      schemas: {
        ...generatedComponents.schemas,
        ...userComponents.schemas,
      },
    };

    const spec: OpenApiSpec = {
      openapi: "3.1.0",
      info: {
        title: options.info.title,
        version: options.info.version,
        description: options.info.description,
      },
      paths,
      tags: [...tags, ...(options.tags || [])],
      servers: options.servers || [],
      components: mergedComponents,
    };

    return spec;
  }

  private normalizePath(path: string): string {
    return path.replace(/:([^/]+)/g, "{$1}");
  }

  private isItemEndpoint(route: RouteMetadata): boolean {
    const path = route.path;
    return path.includes("{id}") || /\/:\w+/.test(path);
  }

  private generateOperation(
    route: RouteMetadata,
    controllerPath?: string,
    tagName?: string,
  ): any {
    const method = route.method.toLowerCase();
    const path = route.path;
    const fullPath = controllerPath ? `${controllerPath}${path}` : path;

    const summaries: Record<string, (path: string, isItem: boolean) => string> =
      {
        get: (p, isItem) =>
          isItem
            ? `Get ${this.getResourceName(p, true)}`
            : `List ${this.getResourceName(p, false)}`,
        post: (p) => `Create ${this.getResourceName(p, true)}`,
        put: (p) => `Update ${this.getResourceName(p, true)}`,
        patch: (p) => `Patch ${this.getResourceName(p, true)}`,
        delete: (p) => `Delete ${this.getResourceName(p, true)}`,
      };

    const descriptions: Record<
      string,
      (path: string, isItem: boolean) => string
    > = {
      get: (p, isItem) =>
        isItem
          ? `Retrieve ${this.getResourceName(p, true).toLowerCase()} details`
          : `List ${this.getResourceName(p, false).toLowerCase()}`,
      post: (p) =>
        `Create a new ${this.getResourceName(p, true).toLowerCase()}`,
      put: (p) =>
        `Update ${this.getResourceName(p, true).toLowerCase()} information`,
      patch: (p) =>
        `Partially update ${this.getResourceName(p, true).toLowerCase()} information`,
      delete: (p) => `Delete a ${this.getResourceName(p, true).toLowerCase()}`,
    };

    const operation: any = {
      operationId: this.generateOperationId(
        route.handlerName,
        tagName,
        method,
        path,
      ),
      summary:
        route.summary ||
        summaries[method](fullPath, this.isItemEndpoint(route)),
      description:
        route.description ||
        descriptions[method](fullPath, this.isItemEndpoint(route)),
      tags:
        route.tags && route.tags.length > 0
          ? route.tags
          : tagName
            ? [tagName]
            : [],
      parameters: this.generateParameters(route.parameters),
      responses: this.generateResponses(route),
    };

    const bodyParam = this.generateRequestBody(route);
    if (bodyParam) {
      operation.requestBody = bodyParam;
    }

    return operation;
  }

  private generateOperationId(
    handlerName: string,
    tagName?: string,
    method?: string,
    path?: string,
  ): string {
    const prefix = tagName ? `${tagName}_` : "";
    const action = method ? this.getOperationAction(method, path || "") : "";
    const suffix = method ? this.getOperationSuffix(method, path || "") : "";

    let operationId = handlerName;
    if (!handlerName || handlerName.length === 0) {
      operationId = prefix + action + suffix;
    } else {
      const camelCase = handlerName
        .replace(/([A-Z])/g, (match) => match.toLowerCase())
        .replace(/^./, (char) => char.toLowerCase());
      operationId = prefix + camelCase;
    }

    return operationId;
  }

  private getOperationAction(method: string, path: string): string {
    const isItemEndpoint = path.includes("{id}") || /\/:\w+/.test(path);

    switch (method) {
      case "get":
        return isItemEndpoint ? "get" : "list";
      case "post":
        return "create";
      case "put":
        return "update";
      case "patch":
        return "patch";
      case "delete":
        return "delete";
      default:
        return method;
    }
  }

  private getOperationSuffix(_method: string, path: string): string {
    if (!path || path.length === 0) {
      return "";
    }

    const parts = path
      .split("/")
      .filter((p) => p.length > 0 && !p.startsWith(":"));
    if (parts.length === 0) {
      return "";
    }

    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (lastPart && !lastPart.match(/^\d+$/)) {
        const capitalized =
          lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
        return capitalized;
      }
    }

    return "";
  }

  private getResourceName(path: string, singular: boolean = false): string {
    if (!path || path === "") {
      return singular ? "Resource" : "Resources";
    }
    const parts = path
      .split("/")
      .filter((p) => p.length > 0 && !p.startsWith(":"));
    if (parts.length === 0) {
      return singular ? "Resource" : "Resources";
    }
    let name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);

    if (singular) {
      name = this.singularize(name);
    }

    if (parts.length > 1) {
      const suffix = parts
        .slice(1)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
      return `${name} ${suffix}`;
    }
    return name;
  }

  private singularize(word: string): string {
    if (!word) return word;
    if (word.endsWith("ies")) {
      return word.slice(0, -3) + "y";
    }
    if (word.endsWith("es")) {
      return word.slice(0, -2);
    }
    if (word.endsWith("s")) {
      return word.slice(0, -1);
    }
    return word;
  }

  private getTagNameFromPath(path: string): string {
    if (!path || path === "") {
      return "default";
    }
    const cleanPath = path.replace(/^\//, "").replace(/\/$/, "");
    return cleanPath.split("/")[0].toLowerCase();
  }

  private generateParameters(parameters?: ParameterMetadata[]): any[] {
    if (!parameters || parameters.length === 0) {
      return [];
    }

    const oaiParameters: any[] = [];
    const sortedParams = [...parameters].sort((a, b) => a.index - b.index);

    sortedParams.forEach((param) => {
      if (param.type === "body") return;

      if (param.type === "params" || param.type === "query") {
        const location = param.type === "params" ? "path" : "query";

        if (param.schema && typeof param.schema.shape === "object") {
          const shape = param.schema.shape;
          Object.keys(shape).forEach((key) => {
            const fieldSchema = shape[key];
            oaiParameters.push({
              name: key,
              in: location,
              required:
                param.required ??
                (location === "path" || !isOptional(fieldSchema)),
              schema: zodToOpenApi(fieldSchema),
            });
          });
        } else {
          let schema = param.schema
            ? zodToOpenApi(param.schema)
            : { type: "string" };

          schema = this.fixCoercePositiveIssue(schema);
          oaiParameters.push({
            name: param.name === "params" ? "id" : param.name,
            in: location,
            required: param.required ?? true,
            schema,
          });
        }
      } else if (param.type === "combined") {
      }
    });

    return oaiParameters;
  }

  private fixCoercePositiveIssue(schema: any): any {
    if (
      schema &&
      typeof schema === "object" &&
      schema.type === "number" &&
      schema.minimum === 0 &&
      schema.exclusiveMinimum === true
    ) {
      schema = { ...schema };
      delete schema.exclusiveMinimum;
      schema.minimum = 1;
      schema.type = "integer";
    }
    return schema;
  }

  private generateRequestBody(route: RouteMetadata): any {
    const bodyParam = route.parameters?.find((p) => p.type === "body");

    if (!bodyParam || !bodyParam.schema) {
      return undefined;
    }

    const schema = zodToOpenApi(bodyParam.schema);

    return {
      description: "Request body",
      required: true,
      content: {
        "application/json": {
          schema,
        },
      },
    };
  }

  private generateResponses(route: RouteMetadata): any {
    const responses: any = {};

    if (route.response || route.entity || route.schema || route.isArray) {
      let statusCode = route.response?.status ?? 200;

      if (!route.response && route.method === "POST") {
        statusCode = 201;
      }
      if (!route.response && route.method === "DELETE") {
        statusCode = 204;
      }

      if (route.response) {
        const schema = this.ensureRequiredFields(route.response.schema);
        responses[statusCode] = {
          description:
            route.response.description || this.getStatusDescription(statusCode),
          content: schema
            ? {
                "application/json": {
                  schema,
                },
              }
            : undefined,
        };
      } else {
        let responseSchema: any;

        if (route.schema) {
          if (route.schema instanceof SchemaModifier) {
            responseSchema = route.schema.toOpenApi();
          } else {
            responseSchema = route.schema;
          }
        } else if (route.entity) {
          const tableDef = getTableDefFromEntity(route.entity);
          if (tableDef) {
            responseSchema = dtoToOpenApiSchema(tableDef);
          }
        }

        if (route.isArray && responseSchema) {
          responseSchema = {
            type: "array",
            items: responseSchema,
          };
        }

        if (statusCode === 204) {
          responses[204] = {
            description: "No Content",
          };
        } else {
          const schema = this.ensureRequiredFields(responseSchema);
          responses[statusCode] = {
            description: this.getStatusDescription(statusCode),
            content: schema
              ? {
                  "application/json": {
                    schema,
                  },
                }
              : undefined,
          };
        }
      }

      if (statusCode !== 204) {
        responses[400] = {
          description: "Bad Request - Invalid input data",
          content: {
            "application/json": {
              schema: this.schemaRegistry.getValidationErrorSchema(),
            },
          },
        };

        if (this.isItemEndpoint(route)) {
          responses[404] = {
            description: "Not Found - Resource not found",
            content: {
              "application/json": {
                schema: this.schemaRegistry.getErrorSchema(),
              },
            },
          };
        }

        responses[500] = {
          description: "Internal Server Error",
          content: {
            "application/json": {
              schema: this.schemaRegistry.getErrorSchema(),
            },
          },
        };
      }
    } else {
      responses[200] = {
        description: "Success",
      };
    }

    return responses;
  }

  private getStatusDescription(statusCode: number): string {
    switch (statusCode) {
      case 200:
        return "Success";
      case 201:
        return "Created";
      case 204:
        return "No Content";
      default:
        return "Success";
    }
  }

  private ensureRequiredFields(schema: any): any {
    return schema;
  }
}
