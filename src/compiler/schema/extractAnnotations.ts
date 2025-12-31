import ts from "typescript";

export interface SchemaFragment {
  [key: string]: unknown;
}

export function extractPropertySchemaFragments(
  checker: ts.TypeChecker,
  prop: ts.PropertyDeclaration | ts.ParameterDeclaration
): SchemaFragment[] {
  if (!ts.canHaveDecorators(prop)) return [];

  const decs = ts.getDecorators(prop);
  if (!decs || decs.length === 0) return [];

  const frags: SchemaFragment[] = [];

  for (const d of decs) {
    const expr = d.expression;

    let callee: ts.Expression;
    let args: ts.NodeArray<ts.Expression>;

    if (ts.isCallExpression(expr)) {
      callee = expr.expression;
      args = expr.arguments;
    } else {
      callee = expr;
      args = ts.factory.createNodeArray([]);
    }

    const sym = checker.getSymbolAtLocation(callee);
    if (!sym) continue;

    const resolved = resolveImportedDecorator(checker, sym);
    if (!resolved || resolved.module !== "adorn-api/schema") continue;

    const name = resolved.name;

    if (name === "Schema") {
      const obj = args[0];
      if (obj && ts.isObjectLiteralExpression(obj)) {
        const frag = objectLiteralToJson(obj);
        if (frag) frags.push(frag);
      }
      continue;
    }

    if (name === "Min" && isNumberLiteral(args[0])) {
      frags.push({ minimum: Number(args[0].text) });
    } else if (name === "Max" && isNumberLiteral(args[0])) {
      frags.push({ maximum: Number(args[0].text) });
    } else if (name === "ExclusiveMin" && isNumberLiteral(args[0])) {
      frags.push({ exclusiveMinimum: Number(args[0].text) });
    } else if (name === "ExclusiveMax" && isNumberLiteral(args[0])) {
      frags.push({ exclusiveMaximum: Number(args[0].text) });
    } else if (name === "MinLength" && isNumberLiteral(args[0])) {
      frags.push({ minLength: Number(args[0].text) });
    } else if (name === "MaxLength" && isNumberLiteral(args[0])) {
      frags.push({ maxLength: Number(args[0].text) });
    } else if (name === "Format" && isStringLiteral(args[0])) {
      frags.push({ format: args[0].text });
    } else if (name === "Pattern") {
      const arg = args[0];
      if (arg && ts.isRegularExpressionLiteral(arg)) {
        frags.push({ pattern: extractRegexPattern(arg.text) });
      } else if (isStringLiteral(arg)) {
        frags.push({ pattern: arg.text });
      }
    } else if (name === "MinItems" && isNumberLiteral(args[0])) {
      frags.push({ minItems: Number(args[0].text) });
    } else if (name === "MaxItems" && isNumberLiteral(args[0])) {
      frags.push({ maxItems: Number(args[0].text) });
    } else if (name === "MinProperties" && isNumberLiteral(args[0])) {
      frags.push({ minProperties: Number(args[0].text) });
    } else if (name === "MaxProperties" && isNumberLiteral(args[0])) {
      frags.push({ maxProperties: Number(args[0].text) });
    } else if (name === "MultipleOf" && isNumberLiteral(args[0])) {
      frags.push({ multipleOf: Number(args[0].text) });
    } else if (name === "Example") {
      frags.push({ example: literalToJson(args[0]) });
    } else if (name === "Examples" && ts.isArrayLiteralExpression(args[0])) {
      frags.push({ examples: args[0].elements.map(e => literalToJson(e)) });
    } else if (name === "Description" && isStringLiteral(args[0])) {
      frags.push({ description: args[0].text });
    } else if (name === "Enum" && ts.isArrayLiteralExpression(args[0])) {
      frags.push({ enum: args[0].elements.map(e => literalToJson(e)) });
    } else if (name === "Const") {
      frags.push({ const: literalToJson(args[0]) });
    } else if (name === "Default") {
      frags.push({ default: literalToJson(args[0]) });
    } else if (name === "AdditionalProperties") {
      const arg = args[0];
      if (arg && (arg.kind === ts.SyntaxKind.FalseKeyword || arg.kind === ts.SyntaxKind.TrueKeyword)) {
        frags.push({ additionalProperties: arg.kind === ts.SyntaxKind.TrueKeyword });
      } else if (arg && ts.isObjectLiteralExpression(arg)) {
        const obj = objectLiteralToJson(arg);
        if (obj) frags.push({ additionalProperties: obj });
      }
    } else if (name === "Closed") {
      frags.push({ additionalProperties: false });
    } else if (name === "ClosedUnevaluated") {
      frags.push({ unevaluatedProperties: false });
    }
  }

  return frags;
}

function resolveImportedDecorator(
  checker: ts.TypeChecker,
  sym: ts.Symbol
): { module: string; name: string } | null {
  const target = (sym.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(sym) : sym;
  const name = target.getName();

  const decl = target.declarations?.[0];
  if (!decl) return null;

  const fileName = decl.getSourceFile().fileName.replace(/\\/g, "/");

  if (fileName.includes("/node_modules/adorn-api/") || fileName.includes("/src/schema/")) {
    return { module: "adorn-api/schema", name };
  }

  return null;
}

function isNumberLiteral(node: ts.Node | undefined): node is ts.NumericLiteral {
  return !!node && ts.isNumericLiteral(node);
}

function isStringLiteral(node: ts.Node | undefined): node is ts.StringLiteral {
  return !!node && ts.isStringLiteral(node);
}

function extractRegexPattern(text: string): string {
  const match = text.match(/^\/(.+)\/[gimsuy]*$/);
  return match ? match[1] : text;
}

function objectLiteralToJson(obj: ts.ObjectLiteralExpression): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = prop.name;
    let key: string;
    if (ts.isIdentifier(name)) {
      key = name.text;
    } else if (ts.isStringLiteral(name)) {
      key = name.text;
    } else {
      continue;
    }
    out[key] = literalToJson(prop.initializer);
  }
  return out;
}

function literalToJson(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isObjectLiteralExpression(node)) return objectLiteralToJson(node);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(e => literalToJson(e));
  return undefined;
}

export function mergeFragments(base: Record<string, unknown>, ...frags: SchemaFragment[]): Record<string, unknown> {
  const result = { ...base };
  for (const frag of frags) {
    Object.assign(result, frag);
  }
  return result;
}

export function extractJSDocDescription(checker: ts.TypeChecker, node: ts.Node): string | undefined {
  const sourceFile = node.getSourceFile();
  const docComments = ts.getLeadingCommentRanges(sourceFile.fileName, node.pos);
  if (!docComments || docComments.length === 0) return undefined;

  const sourceText = sourceFile.getText();
  let fullComment = "";

  for (const commentRange of docComments) {
    const comment = sourceText.substring(commentRange.pos, commentRange.end);
    const cleanComment = comment
      .replace(/^\/\*\*/, "")
      .replace(/\*\/$/, "")
      .replace(/^\s*\*\s?/gm, "")
      .trim();
    fullComment += cleanComment + "\n";
  }

  return fullComment.trim() || undefined;
}

export function extractJSDocTags(checker: ts.TypeChecker, node: ts.Node): Record<string, unknown> {
  const tags: Record<string, unknown> = {};

  const jsDocTags = ts.getJSDocTags(node);
  if (!jsDocTags) return tags;

  for (const tag of jsDocTags) {
    const tagName = tag.tagName.text;

    if (tagName === "example") {
      const exampleComment = getTagComment(tag);
      if (exampleComment) {
        const existing = (tags.examples as string[]) ?? [];
        tags.examples = [...existing, exampleComment];
      }
    } else if (tagName === "default") {
      const defaultComment = getTagComment(tag);
      if (defaultComment) {
        tags.default = parseDefaultValue(defaultComment);
      }
    } else if (tagName === "description") {
      const desc = getTagComment(tag);
      if (desc) {
        tags.description = desc;
      }
    } else if (tagName === "deprecated") {
      tags.deprecated = true;
    }
  }

  return tags;
}

function getTagComment(tag: ts.JSDocTag): string | undefined {
  const comment = tag.comment;
  if (typeof comment === "string") {
    return comment.trim();
  }
  if (comment && Array.isArray(comment) && comment.length > 0) {
    return comment.map(c => typeof c === "string" ? c : c.text).join(" ").trim();
  }
  return undefined;
}

function parseDefaultValue(comment: string): unknown {
  const trimmed = comment.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;

  const num = Number(trimmed);
  if (!isNaN(num) && trimmed === num.toString()) return num;

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function extractClassSchemaFragments(
  checker: ts.TypeChecker,
  classDecl: ts.ClassDeclaration
): SchemaFragment[] {
  const frags: SchemaFragment[] = [];

  if (!ts.canHaveDecorators(classDecl)) return [];

  const decs = ts.getDecorators(classDecl);
  if (!decs || decs.length === 0) return frags;

  for (const d of decs) {
    const expr = d.expression;

    let callee: ts.Expression;
    let args: ts.NodeArray<ts.Expression>;

    if (ts.isCallExpression(expr)) {
      callee = expr.expression;
      args = expr.arguments;
    } else {
      callee = expr;
      args = ts.factory.createNodeArray([]);
    }

    const sym = checker.getSymbolAtLocation(callee);
    if (!sym) continue;

    const resolved = resolveImportedDecorator(checker, sym);
    if (!resolved || resolved.module !== "adorn-api/schema") continue;

    const name = resolved.name;

    if (name === "Schema") {
      const obj = args[0];
      if (obj && ts.isObjectLiteralExpression(obj)) {
        const frag = objectLiteralToJson(obj);
        if (frag) frags.push(frag);
      }
    } else if (name === "Description" && isStringLiteral(args[0])) {
      frags.push({ description: args[0].text });
    } else if (name === "Example") {
      frags.push({ example: literalToJson(args[0]) });
    } else if (name === "Examples" && ts.isArrayLiteralExpression(args[0])) {
      frags.push({ examples: args[0].elements.map(e => literalToJson(e)) });
    } else if (name === "Closed") {
      frags.push({ additionalProperties: false });
    } else if (name === "ClosedUnevaluated") {
      frags.push({ unevaluatedProperties: false });
    }
  }

  const jsDocDesc = extractJSDocDescription(checker, classDecl);
  if (jsDocDesc) {
    frags.push({ description: jsDocDesc });
  }

  const jsDocTags = extractJSDocTags(checker, classDecl);
  if (Object.keys(jsDocTags).length > 0) {
    frags.push(jsDocTags);
  }

  return frags;
}
