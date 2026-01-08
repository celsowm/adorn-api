/**
 * Test for enhanced query builder analyzer with service call support
 */

import { describe, it, expect } from "vitest";
import { analyzeQueryBuilderWithServiceCalls } from "../../src/compiler/schema/queryBuilderAnalyzer.js";

describe("Enhanced Query Builder Analyzer", () => {
  describe("analyzeQueryBuilderWithServiceCalls", () => {
    it("should return method metadata even when no query builder is detected", () => {
      // Create a minimal mock method declaration
      const mockMethod = {
        name: { getText: () => "list" } as any,
        getSourceFile: () => ({ fileName: "test.ts" } as any)
      } as any;

      const result = analyzeQueryBuilderWithServiceCalls(
        mockMethod,
        {} as any,
        {} as any,
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

      expect(result.detected).toBe(false);
      expect(result.methodName).toBe("list");
      expect(result.httpMethod).toBe("GET");
      expect(result.path).toBe("/");
      expect(result.operationId).toBe("listEquipes");
    });

    it("should return correct metadata structure for all HTTP methods", () => {
      const mockMethod = {
        name: { getText: () => "getById" } as any,
        getSourceFile: () => ({ fileName: "test.ts" } as any)
      } as any;

      const testCases = [
        { httpMethod: "GET", path: "/users" },
        { httpMethod: "POST", path: "/users" },
        { httpMethod: "PUT", path: "/users/:id" },
        { httpMethod: "PATCH", path: "/users/:id" },
        { httpMethod: "DELETE", path: "/users/:id" }
      ];

      for (const testCase of testCases) {
        const result = analyzeQueryBuilderWithServiceCalls(
          mockMethod,
          {} as any,
          {} as any,
          { maxDepth: 3, analyzeHelpers: false },
          {
            methodName: testCase.httpMethod.toLowerCase(),
            httpMethod: testCase.httpMethod,
            path: testCase.path,
            operationId: `${testCase.httpMethod.toLowerCase()}User`
          }
        );

        expect(result.methodName).toBe(testCase.httpMethod.toLowerCase());
        expect(result.httpMethod).toBe(testCase.httpMethod);
        expect(result.path).toBe(testCase.path);
        expect(result.operationId).toBe(`${testCase.httpMethod.toLowerCase()}User`);
      }
    });

    it("should handle custom options correctly", () => {
      const mockMethod = {
        name: { getText: () => "search" } as any,
        getSourceFile: () => ({ fileName: "test.ts" } as any)
      } as any;

      const result = analyzeQueryBuilderWithServiceCalls(
        mockMethod,
        {} as any,
        {} as any,
        {
          maxDepth: 5,
          analyzeHelpers: true
        },
        {
          methodName: "search",
          httpMethod: "GET",
          path: "/search",
          operationId: "searchItems"
        }
      );

      expect(result.methodName).toBe("search");
      expect(result.httpMethod).toBe("GET");
      expect(result.path).toBe("/search");
      expect(result.operationId).toBe("searchItems");
    });

    it("should preserve operation context in result", () => {
      const mockMethod = {
        name: { getText: () => "getActive" } as any,
        getSourceFile: () => ({ fileName: "controller.ts" } as any)
      } as any;

      const result = analyzeQueryBuilderWithServiceCalls(
        mockMethod,
        {} as any,
        {} as any,
        { maxDepth: 2, analyzeHelpers: false },
        {
          methodName: "getActive",
          httpMethod: "GET",
          path: "/active",
          operationId: "getActiveItems"
        }
      );

      // Verify that operation context is preserved
      expect(result.methodName).toBe("getActive");
      expect(result.operationId).toBe("getActiveItems");
      expect(result.path).toBe("/active");
    });
  });
});
