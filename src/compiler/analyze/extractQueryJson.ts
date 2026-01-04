import ts from "typescript";

export function extractQueryJsonOptions(
    checker: ts.TypeChecker,
    method: ts.MethodDeclaration
): string[] {
    if (!ts.canHaveDecorators(method)) return [];
    const decorators = ts.getDecorators(method);
    if (!decorators || decorators.length === 0) return [];

    const jsonParams: string[] = [];

    for (const decorator of decorators) {
        const expr = decorator.expression;
        const isCall = ts.isCallExpression(expr);
        const callee = isCall ? expr.expression : expr;
        const args = isCall ? expr.arguments : ts.factory.createNodeArray([]);

        const sym = checker.getSymbolAtLocation(callee);
        if (!sym) continue;

        const resolved = (sym.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(sym) : sym;
        const name = resolved.getName();
        if (name !== "QueryJson") continue;

        const paramNameNode = args[0];
        if (paramNameNode && ts.isStringLiteral(paramNameNode)) {
            jsonParams.push(paramNameNode.text);
        }
    }

    return jsonParams;
}
