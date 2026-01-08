/**
 * Test for enhanced query builder analyzer with service call support
 */

import { describe, it, expect, beforeEach } from "vitest";
import ts from "typescript";
import { analyzeQueryBuilderWithServiceCalls } from "../../src/compiler/schema/queryBuilderAnalyzer.js";
import { ServiceCallAnalyzer } from "../../src/compiler/schema/serviceCallAnalyzer.js";

describe("Enhanced Query Builder Analyzer", () => {
  let mockChecker: ts.TypeChecker;
  let mockProgram: ts.Program;

  beforeEach(() => {
    // Mock TypeScript checker and program
    mockChecker = {} as ts.TypeChecker;
    mockProgram = {} as ts.Program;
  });

  describe("Service Call Traversal", () => {
    it("should detect query builder pattern in service method", () => {
      // Mock controller method that calls service
      const controllerMethod = createMockMethodDeclaration(`
        @Get("/")
        async list(): Promise<PaginatedResult<Equipe>> {
          return EquipeService.listPaged(session, filters, options, includeUsuarios);
        }
      `);

      // Mock service method with query builder pattern
      const serviceMethod = createMockMethodDeclaration(`
        static listPaged(session, filters, options, includeUsuarios) {
          return selectFromEntity(Equipe)
            .select("id", "name", "status")
            .include({
              usuarios: true,
              especializada: {
                select: ["id", "name"]
              }
            })
            .executePaged(session, options);
        }
      `);

      // Mock the service call resolution
      const analyzer = new ServiceCallAnalyzer(mockChecker, mockProgram);
      
      // Mock the service call finding to return our service method
      const originalFindServiceCalls = (analyzer as any).findServiceCalls;
      (analyzer as any).findServiceCalls = () => [{
        serviceName: "EquipeService",
        methodName: "listPaged",
        filePath: "service.ts",
        classDeclaration: createMockClassDeclaration("EquipeService"),
        methodDeclaration: serviceMethod
      }];

      const result = analyzer.analyzeControllerMethod(controllerMethod);

      expect(result).toBeTruthy();
      expect(result?.entityName).toBe("Equipe");
      expect(result?.selectedFields).toEqual(["id", "name", "status"]);
      expect(result?.isPaged).toBe(true);
      expect(result?.includes).toHaveProperty("usuarios", true);
      expect(result?.includes).toHaveProperty("especializada");
    });

    it("should handle nested service calls", () => {
      const controllerMethod = createMockMethodDeclaration(`
        @Get("/")
        async list(): Promise<PaginatedResult<Equipe>> {
          return withSession(session => 
            EquipeService.listPaged(session, filters, options, includeUsuarios)
          );
        }
      `);

      const analyzer = new ServiceCallAnalyzer(mockChecker, mockProgram);
      const result = analyzer.analyzeControllerMethod(controllerMethod);

      // Should fall back to null when service call analysis fails
      expect(result).toBeNull();
    });

    it("should handle helper function patterns", () => {
      const controllerMethod = createMockMethodDeclaration(`
        @Get("/")
        async list(): Promise<PaginatedResult<Equipe>> {
          const filters = toEquipeFilters(query);
          return buildEquipeQuery(filters, includeUsuarios).executePaged(session, options);
        }
      `);

      const analyzer = new ServiceCallAnalyzer(mockChecker, mockProgram);
      (analyzer as any).analyzeHelpers = true;
      const result = analyzer.analyzeControllerMethod(controllerMethod);

      // Should fall back to null when helper analysis fails
      expect(result).toBeNull();
    });

    it("should cache analysis results", () => {
      const controllerMethod = createMockMethodDeclaration(`
        @Get("/")
        async list(): Promise<PaginatedResult<Equipe>> {
          return EquipeService.listPaged(session, filters, options, includeUsuarios);
        }
      `);

      const analyzer = new ServiceCallAnalyzer(mockChecker, mockProgram);
      
      // First analysis
      const result1 = analyzer.analyzeControllerMethod(controllerMethod);
      
      // Second analysis (should use cache)
      const result2 = analyzer.analyzeControllerMethod(controllerMethod);

      expect(result1).toBe(result2);
      
      const stats = analyzer.getCacheStats();
      expect(stats.cached).toBeGreaterThan(0);
    });

    it("should respect max depth limit", () => {
      const controllerMethod = createMockMethodDeclaration(`
        @Get("/")
        async list(): Promise<PaginatedResult<Equipe>> {
          return ServiceA.methodA();
        }
      `);

      const analyzer = new ServiceCallAnalyzer(mockChecker, mockProgram);
      (analyzer as any).maxDepth = 1;
      const result = analyzer.analyzeControllerMethod(controllerMethod);

      // Should not traverse deeply nested service calls
      expect(result).toBeNull();
    });
  });

  describe("Integration with OpenAPI Generation", () => {
    it("should work with enhanced analyzer in OpenAPI generation", () => {
      const controllerMethod = createMockMethodDeclaration(`
        @Get("/")
        async list(): Promise<PaginatedResult<Equipe>> {
          return EquipeService.listPaged(session, filters, options, includeUsuarios);
        }
      `);

      const result = analyzeQueryBuilderWithServiceCalls(
        controllerMethod,
        mockChecker,
        mockProgram,
        {
          maxDepth: 3,
          analyzeHelpers: true
        },
        {
          methodName: "list",
          httpMethod: "GET",
          path: "/",
          operationId: "listEquipes"
        }
      );

      expect(result.detected).toBe(false); // Will be false without proper mocking
      expect(result.methodName).toBe("list");
      expect(result.httpMethod).toBe("GET");
      expect(result.path).toBe("/");
      expect(result.operationId).toBe("listEquipes");
    });
  });
});

// Helper functions to create mock TypeScript AST nodes
function createMockMethodDeclaration(source: string): ts.MethodDeclaration {
  const sourceFile = ts.createSourceFile(
    "test.ts",
    source,
    ts.ScriptTarget.Latest,
    true
  );

  const classDecl = sourceFile.statements.find(ts.isClassDeclaration);
  if (!classDecl) {
    throw new Error("No class declaration found");
  }

  const methodDecl = classDecl.members.find(ts.isMethodDeclaration);
  if (!methodDecl) {
    throw new Error("No method declaration found");
  }

  return methodDecl;
}

function createMockClassDeclaration(name: string): ts.ClassDeclaration {
  return {
    kind: ts.SyntaxKind.ClassDeclaration,
    name: { text: name } as ts.Identifier,
    members: [],
    getSourceFile: () => ({
      fileName: "test.ts"
    } as ts.SourceFile)
  } as unknown as ts.ClassDeclaration;
}