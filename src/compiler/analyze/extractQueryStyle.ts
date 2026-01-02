import ts from "typescript";

export interface QueryStyleOptions {
  style?: "form" | "spaceDelimited" | "pipeDelimited" | "deepObject";
  explode?: boolean;
  allowReserved?: boolean;
}

export function extractQueryStyleOptions(
  checker: ts.TypeChecker,
  method: ts.MethodDeclaration
): QueryStyleOptions | null {
  if (!ts.canHaveDecorators(method)) return null;
  const decorators = ts.getDecorators(method);
  if (!decorators || decorators.length === 0) return null;

  for (const decorator of decorators) {
    const expr = decorator.expression;
    const isCall = ts.isCallExpression(expr);
    const callee = isCall ? expr.expression : expr;
    const args = isCall ? expr.arguments : ts.factory.createNodeArray([]);

    const sym = checker.getSymbolAtLocation(callee);
    if (!sym) continue;

    const resolved = (sym.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(sym) : sym;
    const name = resolved.getName();
    if (name !== "QueryStyle") continue;

    const optsNode = args[0];
    if (!optsNode || !ts.isObjectLiteralExpression(optsNode)) {
      return {};
    }

    return parseQueryStyleOptions(optsNode);
  }

  return null;
}

function parseQueryStyleOptions(node: ts.ObjectLiteralExpression): QueryStyleOptions {
  const opts: QueryStyleOptions = {};

  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = getPropName(prop.name);
    if (!name) continue;

    if (name === "style" && ts.isStringLiteral(prop.initializer)) {
      const style = prop.initializer.text as QueryStyleOptions["style"];
      opts.style = style;
    } else if (name === "explode" && isBooleanLiteral(prop.initializer)) {
      opts.explode = prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
    } else if (name === "allowReserved" && isBooleanLiteral(prop.initializer)) {
      opts.allowReserved = prop.initializer.kind === ts.SyntaxKind.TrueKeyword;
    }
  }

  return opts;
}

function getPropName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  return null;
}

function isBooleanLiteral(node: ts.Expression): node is ts.BooleanLiteral {
  return node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword;
}
