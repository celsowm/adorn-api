import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

export interface ProgramContext {
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFiles: ts.SourceFile[];
}

export function createProgramFromConfig(tsconfigPath: string): ProgramContext {
  const absolutePath = resolve(tsconfigPath);
  const configDir = dirname(absolutePath);

  const configFile = ts.readConfigFile(absolutePath, (path) => readFileSync(path, "utf-8"));
  if (configFile.error) {
    throw new Error(`Failed to read tsconfig: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n")}`);
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, configDir);
  if (parsed.errors.length > 0) {
    const messages = parsed.errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, "\n"));
    throw new Error(`Failed to parse tsconfig:\n${messages.join("\n")}`);
  }

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();

  const sourceFiles = program.getSourceFiles().filter(sf =>
    !sf.isDeclarationFile &&
    !sf.fileName.includes("node_modules")
  );

  return { program, checker, sourceFiles };
}
