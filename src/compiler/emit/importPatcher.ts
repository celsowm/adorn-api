import type * as ts from 'typescript';

export function ensureImportedV(
  tsi: typeof ts,
  sf: ts.SourceFile,
  packageName: string,
): ts.SourceFile {
  const statements = [...sf.statements];

  const importDecls = statements.filter((s) => tsi.isImportDeclaration(s)) as ts.ImportDeclaration[];
  const fromPkg = importDecls.filter(
    (d) => tsi.isStringLiteral(d.moduleSpecifier) && d.moduleSpecifier.text === packageName,
  );

  for (let i = 0; i < fromPkg.length; i++) {
    const d = fromPkg[i];
    const clause = d.importClause;
    if (!clause?.namedBindings) continue;
    if (!tsi.isNamedImports(clause.namedBindings)) continue;

    const els = [...clause.namedBindings.elements];
    const hasV = els.some((e) => e.name.text === 'v');
    if (hasV) return sf;

    els.push(tsi.factory.createImportSpecifier(false, undefined, tsi.factory.createIdentifier('v')));

    const newDecl = tsi.factory.updateImportDeclaration(
      d,
      d.modifiers,
      tsi.factory.updateImportClause(
        clause,
        clause.isTypeOnly,
        clause.name,
        tsi.factory.updateNamedImports(clause.namedBindings, els),
      ),
      d.moduleSpecifier,
      d.assertClause,
    );

    const idx = statements.indexOf(d);
    statements[idx] = newDecl;
    return tsi.factory.updateSourceFile(sf, statements);
  }

  const newImport = tsi.factory.createImportDeclaration(
    undefined,
    tsi.factory.createImportClause(
      false,
      undefined,
      tsi.factory.createNamedImports([
        tsi.factory.createImportSpecifier(false, undefined, tsi.factory.createIdentifier('v')),
      ]),
    ),
    tsi.factory.createStringLiteral(packageName),
    undefined,
  );

  let insertAt = 0;
  while (insertAt < statements.length && tsi.isExpressionStatement(statements[insertAt])) {
    const es = statements[insertAt] as ts.ExpressionStatement;
    if (!tsi.isStringLiteral(es.expression)) break;
    insertAt++;
  }

  statements.splice(insertAt, 0, newImport);
  return tsi.factory.updateSourceFile(sf, statements);
}
