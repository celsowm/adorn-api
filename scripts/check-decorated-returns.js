import * as ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const configPath = path.resolve(repoRoot, 'tsconfig.json');

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
  console.error(`Failed to read tsconfig at ${configPath}: ${message}`);
  process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, repoRoot);
if (parsed.errors.length > 0) {
  const messages = parsed.errors
    .map((err) => ts.flattenDiagnosticMessageText(err.messageText, '\n'))
    .join('\n');
  console.error(`Failed to parse tsconfig at ${configPath}:\n${messages}`);
  process.exit(1);
}

const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
const httpDecorators = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete']);
const errors = [];

function isHttpDecorator(decorator) {
  const expr = decorator.expression;
  if (!ts.isCallExpression(expr)) return false;
  const callee = expr.expression;
  if (ts.isIdentifier(callee)) return httpDecorators.has(callee.text);
  if (ts.isPropertyAccessExpression(callee)) return httpDecorators.has(callee.name.text);
  return false;
}

function checkSourceFile(sourceFile) {
  const fileName = path.normalize(sourceFile.fileName);
  if (sourceFile.isDeclarationFile) return;
  if (fileName.includes(`${path.sep}node_modules${path.sep}`)) return;
  if (fileName.includes(`${path.sep}dist${path.sep}`)) return;

  const visit = (node) => {
    if (ts.isMethodDeclaration(node)) {
      const decorators = ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
      const hasHttpDecorator = decorators.some(isHttpDecorator);
      if (hasHttpDecorator && !node.type) {
        const nameNode = node.name ?? node;
        const pos = nameNode.getStart(sourceFile, false);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        const methodName = ts.isIdentifier(node.name) ? node.name.text : '(anonymous)';
        errors.push({
          fileName: sourceFile.fileName,
          line: line + 1,
          column: character + 1,
          methodName,
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

for (const sourceFile of program.getSourceFiles()) {
  checkSourceFile(sourceFile);
}

if (errors.length > 0) {
  console.error('Missing explicit return types on HTTP-decorated methods:');
  for (const err of errors) {
    const rel = path.relative(repoRoot, err.fileName) || err.fileName;
    console.error(`  ${rel}:${err.line}:${err.column} ${err.methodName}`);
  }
  console.error('Add an explicit return type annotation to each method.');
  process.exit(1);
}
