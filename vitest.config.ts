import path from "node:path";
import fs from "node:fs";
import * as ts from "typescript";
import { defineConfig } from "vitest/config";

function transpileSourcePlugin() {
  return {
    name: "transpile-source",
    enforce: "pre",
    load(id: string) {
      const cleanId = id.split(/[?#]/)[0];
      const normalizedId = cleanId.split(path.sep).join("/");
      if (
        !normalizedId.includes("/src/") &&
        !normalizedId.includes("/examples/") &&
        !normalizedId.includes("/tests/")
      ) {
        return undefined;
      }
      if (!normalizedId.endsWith(".ts") && !normalizedId.endsWith(".tsx")) {
        return undefined;
      }

      const code = fs.readFileSync(cleanId, "utf8");
      const result = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Node,
          experimentalDecorators: false,
          emitDecoratorMetadata: false,
          useDefineForClassFields: true,
          esModuleInterop: true,
          sourceMap: true
        },
        fileName: cleanId
      });

      return {
        code: result.outputText,
        map: result.sourceMapText ? JSON.parse(result.sourceMapText) : undefined
      };
    }
  };
}

export default defineConfig({
  plugins: [transpileSourcePlugin()],
  test: {
    environment: "node",
    pool: "threads",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"]
  }
});
