import type * as ts from 'typescript';
import { emitSchemaExprForType } from '../schema/typeToSchemaExpr.js';

function sanitizeIdent(name: string): string {
  const s = name.replace(/[^a-zA-Z0-9_]/g, '_');
  return s.length ? s : 'T';
}

export class SchemaHoister {
  private readonly created = new Map<string, ts.Identifier>();
  private readonly decls: ts.Statement[] = [];
  private counter = 1;

  constructor(
    private readonly tsi: typeof ts,
    private readonly checker: ts.TypeChecker,
    private readonly strictObjects: boolean,
    private readonly vIdent: ts.Identifier,
  ) {}

  getDeclarations(): ts.Statement[] {
    return this.decls;
  }

  getOrCreate(type: ts.Type, preferredName: string): ts.Expression | undefined {
    const key = this.keyFor(type) ?? `anon:${preferredName}`;

    const existing = this.created.get(key);
    if (existing) return existing;

    const name = this.uniqueIdent(preferredName);
    const id = this.tsi.factory.createIdentifier(name);

    const expr = emitSchemaExprForType(type, {
      ts: this.tsi,
      checker: this.checker,
      vIdent: this.vIdent,
      strictObjects: this.strictObjects,
      getOrCreateNamedSchema: (t) => {
        const sym = t.getSymbol?.();
        const symName = sym?.getName?.();
        if (!symName || symName === '__type') return undefined;
        return this.getOrCreate(t, symName) as ts.Expression | undefined;
      },
    });

    if (!expr) return undefined;

    const decl = this.tsi.factory.createVariableStatement(
      undefined,
      this.tsi.factory.createVariableDeclarationList(
        [this.tsi.factory.createVariableDeclaration(id, undefined, undefined, expr)],
        this.tsi.NodeFlags.Const,
      ),
    );

    this.created.set(key, id);
    this.decls.push(decl);
    return id;
  }

  private uniqueIdent(preferredName: string): string {
    const base = `__adorn_${sanitizeIdent(preferredName)}`;
    const used = new Set(Array.from(this.created.values()).map((x) => x.text));
    if (!used.has(base)) return base;
    while (used.has(`${base}_${this.counter}`)) this.counter++;
    return `${base}_${this.counter++}`;
  }

  private keyFor(type: ts.Type): string | undefined {
    const sym = type.getSymbol?.();
    if (!sym) return undefined;
    return this.checker.getFullyQualifiedName(sym);
  }
}
