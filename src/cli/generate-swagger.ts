// src/cli/generate-swagger.ts
import { Project, Type, SyntaxKind, ClassDeclaration, Symbol as MorphSymbol, PropertyDeclaration } from "ts-morph";
import * as fs from "fs";

const PROJECT_ROOT = "./tsconfig.json";
const OUTPUT_FILE = "./swagger.json";

const project = new Project({ tsConfigFilePath: PROJECT_ROOT });

const openApiSpec: any = {
  openapi: "3.0.0",
  info: { title: "Adorn API", version: "2.0.0" },
  paths: {},
  components: { 
    schemas: {},
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },
};

// --- Helper: Deep Type Resolver ---
// This converts TypeScript Types (Generics, Interfaces, Primitives) into JSON Schema
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
    
    // Extract literal values (e.g., "active", 100)
    const literals = unionTypes
      .map(t => t.isLiteral() ? t.getLiteralValue() : null)
      .filter(val => val !== null);

    // If we found literals, it's an Enum
    if (literals.length > 0) {
      const isString = typeof literals[0] === 'string';
      return {
        type: isString ? 'string' : 'integer',
        enum: literals
      };
    }
    
    // If it's a mix of objects (e.g. User | Admin), OpenApi uses 'oneOf'
    // Simplified for this demo: take the first non-null type
    return resolveSchema(unionTypes[0], collectedSchemas);
  }

  // 3. Handle Objects (Classes, Interfaces, Nested Literals)
  if (type.isObject()) {
    // Recursion Guard: If we've seen this type name before in components, reference it!
    // (This prevents infinite loops and reduces swagger size)
    const symbol = type.getSymbol();
    const typeName = symbol?.getName();
    
    // Common excluded types
    if (typeName === "Promise") {
        return resolveSchema(type.getTypeArguments()[0], collectedSchemas);
    }
    if (typeName === "Date") return { type: "string", format: "date-time" };

    // If it's a named class/interface (e.g. "Address"), and we haven't processed it, 
    // we could add it to components.schemas. For now, we inline it for simplicity.
    
    const properties = type.getProperties();
    const schema: any = { type: "object", properties: {}, required: [] };

    properties.forEach((prop) => {
      const propName = prop.getName();
      if (propName.startsWith("_")) return; // Skip privates

      // Get the type of the property using getTypeAtLocation
      const declarations = prop.getDeclarations();
      if (declarations.length > 0) {
        const propType = prop.getTypeAtLocation(declarations[0]);
        
        if (propType) {
          // RECURSION HERE: Pass the property type back into resolveSchema
          schema.properties[propName] = resolveSchema(propType, collectedSchemas);
          
          if (!prop.isOptional()) {
            schema.required.push(propName);
          }
        }
      }
    });

    return schema;
  }

  return { type: "string" }; // Fallback
}

function processController(classDec: ClassDeclaration) {
  const controllerDec = classDec.getDecorators().find((d) => d.getName() === "Controller");
  if (!controllerDec) return;

  const basePath = controllerDec.getArguments()[0]?.getText().replace(/['"]/g, "") || "/";

  classDec.getMethods().forEach((method) => {
    const getDec = method.getDecorator("Get");
    const postDec = method.getDecorator("Post");
    const putDec = method.getDecorator("Put");
    const deleteDec = method.getDecorator("Delete");
    const decorator = getDec || postDec || putDec || deleteDec;
    if (!decorator) return;

    const httpMethod = getDec ? "get" : postDec ? "post" : putDec ? "put" : "delete";
    const pathArg = decorator.getArguments()[0]?.getText().replace(/['"]/g, "") || "/";
    const fullPath = `/${basePath}${pathArg}`.replace("//", "/");

    const parameters: any[] = [];
    const requestBody: any = { content: {} };

    // --- 1. Request Analysis (Input DTOs) ---
    const params = method.getParameters();
    if (params.length > 0) {
      const param = params[0];
      const paramType = param.getType(); // This resolves generics and inheritance!
      
      // Iterate ALL properties of the type (inherited included)
      paramType.getProperties().forEach(prop => {
        const propName = prop.getName();
        
        // We need to check Decorators. 
        // Note: In mapped types/generics, getting decorators is hard.
        // We fallback to checking the source declaration.
        const declarations = prop.getDeclarations();
        let isQuery = false;
        let isBody = false;
        let isPath = false;

        // Check decorators on the definition
        declarations.forEach(decl => {
            if (decl.getKind() === SyntaxKind.PropertyDeclaration) {
                const pDecl = decl as PropertyDeclaration;
                if (pDecl.getDecorator("FromQuery")) isQuery = true;
                if (pDecl.getDecorator("FromPath")) isPath = true;
                if (pDecl.getDecorator("FromBody")) isBody = true;
            }
        });

        // IMPLICIT RULES:
        // If it's a GET, and not path, default to Query.
        // If it's a POST, and not path/query, default to Body.
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
    const controllerAuthDec = classDec.getDecorator("Authorized");

    const isAuth = !!authDec || !!controllerAuthDec;

    // --- 3. Response Analysis (Return Type) ---
    const returnType = method.getReturnType(); // e.g. Promise<EntityResponse<User>>
    const responseSchema = resolveSchema(returnType, openApiSpec.components.schemas);

    if (!openApiSpec.paths[fullPath]) openApiSpec.paths[fullPath] = {};
    openApiSpec.paths[fullPath][httpMethod] = {
      operationId: method.getName(),
      parameters,
      requestBody: Object.keys(requestBody.content).length ? requestBody : undefined,
      security: isAuth ? [{ bearerAuth: [] }] : undefined,
      responses: {
        200: {
          description: "Success",
          content: {
            "application/json": { schema: responseSchema }
          }
        }
      }
    };
  });
}

console.log("🔍 Scanning...");
const sourceFiles = project.getSourceFiles("tests/example-app/**/*.ts");
sourceFiles.forEach(file => file.getClasses().forEach(processController));
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(openApiSpec, null, 2));
console.log(`✅ Generated ${OUTPUT_FILE}`);
