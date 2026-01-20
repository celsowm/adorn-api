import { getColumnMap, type ColumnDef } from "metal-orm";
import { t, type SchemaNode } from "../../core/schema";

export interface CreateMetalDtoOverridesOptions {
  overrides?: Record<string, SchemaNode>;
  exclude?: string[];
  entityName?: string;
  timestampDescription?: string;
}

export function createMetalDtoOverrides(
  target: any,
  options: CreateMetalDtoOverridesOptions = {}
): Record<string, SchemaNode> {
  const columns = getColumnMap(target);
  const {
    overrides = {},
    exclude = [],
    entityName = target.name,
    timestampDescription = "Creation timestamp."
  } = options;

  const result: Record<string, SchemaNode> = {};

  for (const [name, col] of Object.entries(columns)) {
    if (exclude.includes(name)) continue;

    if (overrides[name]) {
      result[name] = overrides[name];
      continue;
    }

    const convention = inferFromMetadata(name, col, entityName, timestampDescription);
    if (convention) {
      result[name] = convention;
    }
  }

  return result;
}

function inferFromMetadata(
  name: string,
  col: ColumnDef,
  entityName: string,
  timestampDescription: string
): SchemaNode | null {
  const normalizedType = col.type.toUpperCase();

  if (col.primary || col.autoIncrement) {
    return t.integer({
      minimum: 1,
      description: `${entityName} id.`
    });
  }

  if (col.references) {
    const targetEntity = extractEntityName(col.references.table);
    return t.integer({
      minimum: 1,
      description: `${targetEntity} id.`
    });
  }

  if (normalizedType === "DATETIME" || normalizedType === "TIMESTAMP") {
    return t.dateTime({ description: timestampDescription });
  }

  if (col.notNull && isTextColumn(col)) {
    return t.string({ minLength: 1 });
  }

  if (!col.notNull && isTextColumn(col)) {
    return t.nullable(t.string());
  }

  if (col.notNull && isIntegerColumn(col)) {
    return t.integer({ minimum: 1 });
  }

  if (!col.notNull && isIntegerColumn(col)) {
    return t.nullable(t.integer());
  }

  return null;
}

function extractEntityName(tableName: string): string {
  const pascalCase = tableName
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
  
  return singularize(pascalCase);
}

function singularize(word: string): string {
  if (word.endsWith("ies")) {
    return word.slice(0, -3) + "y";
  }
  if (word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

function isTextColumn(col: ColumnDef): boolean {
  const type = col.type.toUpperCase();
  return type === "TEXT" || type === "VARCHAR" || type === "CHAR";
}

function isIntegerColumn(col: ColumnDef): boolean {
  const type = col.type.toUpperCase();
  return type === "INT" || type === "INTEGER" || type === "BIGINT";
}
