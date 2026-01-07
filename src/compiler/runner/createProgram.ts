/**
 * TypeScript program creation module.
 * Sets up the TypeScript compiler API for source analysis.
 */
import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

/**
 * Context object containing the TypeScript program, type checker, and source files.
 * Used throughout the compiler for source analysis and type information.
 */
export interface ProgramContext {
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFiles: ts.SourceFile[];
}

/**
 * Creates a TypeScript program from a tsconfig.json file.
 * Parses the configuration and sets up the compiler host for source analysis.
 * 
 * @param tsconfigPath - Path to the TypeScript configuration file
 * @returns ProgramContext containing the program, checker, and filtered source files
 * @throws Error if the config file cannot be read or parsed
 */
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
