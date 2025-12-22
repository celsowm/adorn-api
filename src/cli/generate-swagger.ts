import path from "path";
import { Project, Type, SyntaxKind, ClassDeclaration, PropertyDeclaration } from "ts-morph";
import * as fs from "fs";
  import type { AdornConfig } from "../core/config.js";
  import { DEFAULT_STATUS_CODES } from "../core/config.js";

export async function generateSwagger(config: AdornConfig): Promise<void> {
  const project = new Project({ tsConfigFilePath: config.generation.tsConfig });

  const openApiSpec: any = {
    openapi: "3.0.0",
    info: {
      title: config.swagger.info.title,
      version: config.swagger.info.version,
      ...(config.swagger.info.description && { description: config.swagger.info.description }),
    },
    paths: {},
    components: { 
      schemas: {},
      securitySchemes: {
        ...config.swagger.securitySchemes,
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
  };

  // --- Helper: Deep Type Resolver ---
  function resolveSchema(type: Type, collectedSchemas: Record<string, any>): any {
    // 1. Handle Primitives
    if (type.isString() || type.isStringLiteral()) return { type: "string" };
    if (type.isNumber() || type.isNumberLiteral()) return { type: "integer" };
    if (type.isBoolean() || type.isBooleanLiteral()) return { type: "boolean" };
    if (type.isArray()) {
      const arrayType = type.getArrayElementType();
      return {
        type: "array",
        items: arrayType ? resolveSchema(arrayType, collectedSchemas) : {},
      };
    }

    // 2. Handle Union Types (Enums)
    if (type.isUnion()) {
      const unionTypes = type.getUnionTypes();
      
      const literals = unionTypes
        .map(t => t.isLiteral() ? t.getLiteralValue() : null)
        .filter(val => val !== null);

      if (literals.length > 0) {
        const isString = typeof literals[0] === 'string';
        return {
          type: isString ? 'string' : 'integer',
          enum: literals
        };
      }
      
      return resolveSchema(unionTypes[0], collectedSchemas);
    }

    // 3. Handle Objects (Classes, Interfaces, Nested Literals)
    if (type.isObject()) {
      const symbol = type.getSymbol();
      const typeName = symbol?.getName();
      
      if (typeName === "Promise") {
          return resolveSchema(type.getTypeArguments()[0], collectedSchemas);
      }
      if (typeName === "Date") return { type: "string", format: "date-time" };

      const properties = type.getProperties();
      const schema: any = { type: "object", properties: {}, required: [] };

      properties.forEach((prop) => {
        const propName = prop.getName();
        if (propName.startsWith("_")) return;

        const declarations = prop.getDeclarations();
        if (declarations.length > 0) {
          const propType = prop.getTypeAtLocation(declarations[0]);
          
          if (propType) {
            schema.properties[propName] = resolveSchema(propType, collectedSchemas);
            
            if (!prop.isOptional()) {
              schema.required.push(propName);
            }
          }
        }
      });

      return schema;
    }

    return { type: "string" };
  }

  function processController(classDec: ClassDeclaration): void {
    const controllerDec = classDec.getDecorators().find((d) => d.getName() === "Controller");
    if (!controllerDec) return;

    const controllerBasePath = controllerDec.getArguments()[0]?.getText().replace(/['"]/g, "") || "/";

    classDec.getMethods().forEach((method) => {
      const getDec = method.getDecorator("Get");
      const postDec = method.getDecorator("Post");
      const putDec = method.getDecorator("Put");
      const deleteDec = method.getDecorator("Delete");
      const patchDec = method.getDecorator("Patch");
      const decorator = getDec || postDec || putDec || deleteDec || patchDec;
      if (!decorator) return;

      const httpMethod = getDec ? "get" : postDec ? "post" : putDec ? "put" : deleteDec ? "delete" : "patch";
      const pathArg = decorator.getArguments()[0]?.getText().replace(/['"]/g, "") || "/";
      
      // Normalize path
      const globalBasePath = config.generation.basePath || "";
      const fullPath = normalizePath(globalBasePath, controllerBasePath, pathArg);

      const parameters: any[] = [];
      const requestBody: any = { content: {} };

      // --- 1. Request Analysis (Input DTOs) ---
      const params = method.getParameters();
      if (params.length > 0) {
        const param = params[0];
        const paramType = param.getType();
        
        paramType.getProperties().forEach(prop => {
          const propName = prop.getName();
          
          const declarations = prop.getDeclarations();
          let isQuery = false;
          let isBody = false;
          let isPath = false;

          declarations.forEach(decl => {
              if (decl.getKind() === SyntaxKind.PropertyDeclaration) {
                  const pDecl = decl as PropertyDeclaration;
                  if (pDecl.getDecorator("FromQuery")) isQuery = true;
                  if (pDecl.getDecorator("FromPath")) isPath = true;
                  if (pDecl.getDecorator("FromBody")) isBody = true;
                  if (pDecl.getDecorator("FromHeader")) isQuery = true;
                  if (pDecl.getDecorator("FromCookie")) isQuery = true;
                  if (pDecl.getDecorator("UploadedFile")) isBody = true;
              }
          });

          // IMPLICIT RULES:
          if (!isQuery && !isPath && !isBody) {
              if (httpMethod === "get") isQuery = true;
              else isBody = true;
          }

          const propType = prop.getTypeAtLocation(param.getSourceFile());
          const propTypeSchema = resolveSchema(propType, openApiSpec.components.schemas);

          if (isPath) {
              parameters.push({ name: propName, in: "path", required: true, schema: propTypeSchema });
          } else if (isQuery) {
              parameters.push({ name: propName, in: "query", required: !prop.isOptional(), schema: propTypeSchema });
          } else if (isBody) {
               if (!requestBody.content["application/json"]) {
                   requestBody.content["application/json"] = { schema: { type: "object", properties: {}, required: [] } };
                }
                const bodySchema = requestBody.content["application/json"].schema;
                bodySchema.properties[propName] = propTypeSchema;
                if (!prop.isOptional()) bodySchema.required.push(propName);
          }
        });
      }

      // --- 2. Authentication Check ---
      const authDec = method.getDecorator("Authorized");
      const controllerAuthDec = classDec.getDecorators().find(d => d.getName() === "Authorized");

      const isAuth = !!authDec || !!controllerAuthDec;

      // --- 2.5 Phase 3: Tags, Summary, Description, Errors ---
      const tagsDec = method.getDecorator("Tags");
      const summaryDec = method.getDecorator("Summary");
      const descriptionDec = method.getDecorator("Description");
      const errorsDec = method.getDecorator("Errors");

      // --- 3. Status Code Determination ---
      const statusDec = method.getDecorator("Status");
      const customStatus = statusDec ? Number(statusDec.getArguments()[0]?.getText()) : undefined;
      const defaultStatus = DEFAULT_STATUS_CODES[httpMethod];
      const statusCode = customStatus ?? defaultStatus;

      // --- 4. Response Analysis (Return Type) ---
      const returnType = method.getReturnType();
      const responseSchema = resolveSchema(returnType, openApiSpec.components.schemas);

      // --- 5. Build operation object ---
      if (!openApiSpec.paths[fullPath]) openApiSpec.paths[fullPath] = {};
      
      // Extract tags from decorator
      const tags = tagsDec ? tagsDec.getArguments().map(arg => arg.getText().replace(/['"]/g, '')) : undefined;
      
      // Extract summary from decorator
      const summary = summaryDec ? summaryDec.getArguments()[0]?.getText().replace(/['"]/g, '') : undefined;
      
      // Extract description from decorator
      const description = descriptionDec ? descriptionDec.getArguments()[0]?.getText().replace(/['"]/g, '') : undefined;
      
      // Extract error responses from decorator
      const errorResponses: Record<number, any> = {};
      if (errorsDec) {
        const errorsArg = errorsDec.getArguments()[0]?.getText();
        if (errorsArg) {
          // Parse error responses - this is a simplified approach
          // In a full implementation, you'd parse this more carefully
          try {
            const errors = eval(`(${errorsArg})`);
            errors.forEach((err: any) => {
              if (err.statusCode) {
                errorResponses[err.statusCode] = {
                  description: err.description || 'Error',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          error: { type: 'string' },
                          details: err.schema ? JSON.parse(JSON.stringify(err.schema)) : { type: 'string' }
                        }
                      }
                    }
                  }
                };
              }
            });
          } catch (e) {
            console.warn(`Could not parse @Errors decorator: ${e}`);
          }
        }
      }
      
      // Add default error responses (400, 401, 404, 500)
      if (isAuth) {
        errorResponses[401] = {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' }
                }
              }
            }
          }
        };
      }
      
      // Add 404 for any endpoint with path parameters
      if (parameters.some(p => p.in === 'path')) {
        errorResponses[404] = {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' }
                }
              }
            }
          }
        };
      }
      
      // Add 400 for POST/PUT/PATCH with body
      if (requestBody.content['application/json']) {
        errorResponses[400] = {
          description: 'Bad Request - Validation failed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  details: { type: 'object' }
                }
              }
            }
          }
        };
      }
      
      // Add 500 as default error
      errorResponses[500] = {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              }
            }
          }
        }
      };
      
      // Build response object
      const response: any = {
        description: "Success",
      };

      // Only include content for non-204 responses
      if (statusCode !== 204) {
        response.content = {
          "application/json": { schema: responseSchema }
        };
      }

      const operation: any = {
        operationId: method.getName(),
        parameters,
        requestBody: Object.keys(requestBody.content).length ? requestBody : undefined,
        security: isAuth ? [{ bearerAuth: [] }] : undefined,
        responses: {
          [statusCode]: response,
          ...errorResponses
        }
      };

      // Add optional Phase 3 metadata
      if (tags) operation.tags = tags;
      if (summary) operation.summary = summary;
      if (description) operation.description = description;

      openApiSpec.paths[fullPath][httpMethod] = operation;
    });
  }

  console.log("🔍 Scanning...");
  // Use controller-only glob for swagger if configured, otherwise use regular controllers glob
  const swaggerGlob = config.swagger.controllersGlob || config.generation.controllersGlob;
  const sourceFiles = project.getSourceFiles(swaggerGlob);
  sourceFiles.forEach(file => file.getClasses().forEach(processController));
  
  // Ensure output directory exists
  const outputDir = path.dirname(config.swagger.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(config.swagger.outputPath, JSON.stringify(openApiSpec, null, 2));
  console.log(`✅ Generated ${config.swagger.outputPath}`);
}

/**
 * Normalize route paths to ensure proper joining
 * Handles edge cases like missing/extra slashes
 */
function normalizePath(globalBase: string, controllerBase: string, methodPath: string): string {
  // Remove leading/trailing slashes
  const cleanGlobal = globalBase.replace(/^\/+|\/+$/g, '');
  const cleanController = controllerBase.replace(/^\/+|\/+$/g, '');
  const cleanMethod = methodPath.replace(/^\/+|\/+$/g, '');
  
  // Build path parts
  const parts: string[] = [];
  if (cleanGlobal) parts.push(cleanGlobal);
  if (cleanController) parts.push(cleanController);
  if (cleanMethod) parts.push(cleanMethod);
  
  // Join with single slashes and convert {param} to :param for Express
  let fullPath = '/' + parts.join('/');
  fullPath = fullPath.replace(/{/g, ':').replace(/}/g, '');
  
  return fullPath;
}
