import { z } from "zod";
import { getTableDefFromEntity } from "metal-orm";

type ColumnDef = {
  type: string;
  length?: number;
  notNull?: boolean;
  values?: string[];
  default?: any;
  isPrimaryKey?: boolean;
  isGenerated?: boolean;
  primary?: boolean;
  args?: number[];
};

type EntitySchemaBuilderOptions = {
  exclude?: string[];
  include?: string[];
  includeRelations?: string[];
  flat?: boolean;
};

export class EntitySchemaBuilder {
  private static readonly TYPE_MAP: Record<
    string,
    { zod: string; coerce?: boolean }
  > = {
    INT: { zod: "number", coerce: true },
    INTEGER: { zod: "number", coerce: true },
    BIGINT: { zod: "number", coerce: true },
    SMALLINT: { zod: "number", coerce: true },
    FLOAT: { zod: "number" },
    DOUBLE: { zod: "number" },
    DECIMAL: { zod: "number" },
    VARCHAR: { zod: "string" },
    TEXT: { zod: "string" },
    STRING: { zod: "string" },
    CHAR: { zod: "string" },
    BOOLEAN: { zod: "boolean" },
    BOOL: { zod: "boolean" },
    DATE: { zod: "string" },
    TIMESTAMP: { zod: "string" },
    DATETIME: { zod: "string" },
    UUID: { zod: "string" },
    JSON: { zod: "any" },
    ENUM: { zod: "string" },
    int: { zod: "number", coerce: true },
    integer: { zod: "number", coerce: true },
    bigint: { zod: "number", coerce: true },
    smallint: { zod: "number", coerce: true },
    float: { zod: "number" },
    double: { zod: "number" },
    decimal: { zod: "number" },
    varchar: { zod: "string" },
    text: { zod: "string" },
    string: { zod: "string" },
    char: { zod: "string" },
    boolean: { zod: "boolean" },
    bool: { zod: "boolean" },
    date: { zod: "string" },
    timestamp: { zod: "string" },
    datetime: { zod: "string" },
    uuid: { zod: "string" },
    json: { zod: "any" },
    enum: { zod: "string" },
  };

  static create(
    entity: any,
    options: EntitySchemaBuilderOptions = {},
  ): z.ZodObject<any> {
    const entityName = entity?.name || entity;
    let tableDef: any = getTableDefFromEntity(entity);

    if (!tableDef && entity?.tableDef) {
      tableDef = entity.tableDef;
    }

    if (!tableDef) {
      const symbols = Object.getOwnPropertySymbols(entity);
      for (const sym of symbols) {
        if (sym.description === "Symbol.metadata") {
          const metadata = entity[sym];
          const decorators = metadata?.["metal-orm:decorators"];
          if (decorators?.columns) {
            tableDef = this.columnsToTableDef(decorators.columns, entityName);
            break;
          }
        }
      }
    }

    if (!tableDef) {
      throw new Error(
        `Cannot get table definition from entity: ${entityName}. ` +
          `Has bootstrapEntities() been called?`,
      );
    }

    const columns = this.getColumns(tableDef, options);
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [name, column] of Object.entries(columns)) {
      if (column.isPrimaryKey || column.isGenerated) continue;
      shape[name] = this.columnToZod(name, column, { required: true });
    }

    return z.object(shape);
  }

  static update(
    entity: any,
    options: EntitySchemaBuilderOptions = {},
  ): z.ZodObject<any> {
    const entityName = entity?.name || entity;
    let tableDef: any = getTableDefFromEntity(entity);

    if (!tableDef && entity?.tableDef) {
      tableDef = entity.tableDef;
    }

    if (!tableDef) {
      const symbols = Object.getOwnPropertySymbols(entity);
      for (const sym of symbols) {
        if (sym.description === "Symbol.metadata") {
          const metadata = entity[sym];
          const decorators = metadata?.["metal-orm:decorators"];
          if (decorators?.columns) {
            tableDef = this.columnsToTableDef(decorators.columns, entityName);
            break;
          }
        }
      }
    }

    if (!tableDef) {
      throw new Error(
        `Cannot get table definition from entity: ${entityName}. ` +
          `Has bootstrapEntities() been called?`,
      );
    }

    const columns = this.getColumns(tableDef, options);
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [name, column] of Object.entries(columns)) {
      if (column.isPrimaryKey || column.isGenerated) continue;
      let zodType = this.columnToZod(name, column, { required: false });
      zodType = zodType.optional();
      shape[name] = zodType;
    }

    return z.object(shape);
  }

  static idParams(entity: any): z.ZodObject<any> {
    const entityName = entity?.name || entity;
    let tableDef: any = getTableDefFromEntity(entity);

    if (!tableDef && entity?.tableDef) {
      tableDef = entity.tableDef;
    }

    if (!tableDef) {
      const symbols = Object.getOwnPropertySymbols(entity);
      for (const sym of symbols) {
        if (sym.description === "Symbol.metadata") {
          const metadata = entity[sym];
          const decorators = metadata?.["metal-orm:decorators"];
          if (decorators?.columns) {
            tableDef = this.columnsToTableDef(decorators.columns, entityName);
            break;
          }
        }
      }
    }

    if (!tableDef) {
      throw new Error(
        `Cannot get table definition from entity: ${entityName}. ` +
          `Has bootstrapEntities() been called?`,
      );
    }

    const columns = tableDef.columns as Record<string, ColumnDef>;
    let pkColumn: ColumnDef | null = null;
    let pkName = "id";

    for (const [name, column] of Object.entries(columns)) {
      if (column.isPrimaryKey || column.primary) {
        pkColumn = column;
        pkName = name;
        break;
      }
    }

    if (!pkColumn) {
      pkColumn = { type: "INT", notNull: true, isPrimaryKey: true };
    }

    return z.object({
      [pkName]: this.columnToZod(pkName, pkColumn, {
        required: true,
        coerceToInt: true,
      }),
    });
  }

  static response(entity: any, options: EntitySchemaBuilderOptions = {}): any {
    const entityName = entity?.name || entity;
    let tableDef: any = getTableDefFromEntity(entity);

    if (!tableDef && entity?.tableDef) {
      tableDef = entity.tableDef;
    }

    if (!tableDef) {
      const symbols = Object.getOwnPropertySymbols(entity);
      for (const sym of symbols) {
        if (sym.description === "Symbol.metadata") {
          const metadata = entity[sym];
          const decorators = metadata?.["metal-orm:decorators"];
          if (decorators?.columns) {
            tableDef = this.columnsToTableDef(decorators.columns, entityName);
            break;
          }
        }
      }
    }

    if (!tableDef) {
      throw new Error(
        `Cannot get table definition from entity: ${entityName}. ` +
          `Has bootstrapEntities() been called?`,
      );
    }

    const columns = this.getColumns(tableDef, options);
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [name, column] of Object.entries(columns)) {
      properties[name] = this.columnToOpenApi(name, column);

      if (column.notNull) {
        required.push(name);
      }
    }

    const schema: any = {
      type: "object",
      additionalProperties: false,
      properties,
    };

    if (required.length > 0) {
      schema.required = required;
    }

    return schema;
  }

  private static columnsToTableDef(columns: any[], entityName: string): any {
    const tableDef: any = {
      name: entityName.toLowerCase() + "s",
      columns: {},
    };

    for (const col of columns) {
      const name = col.propertyName;
      tableDef.columns[name] = {
        type: col.column?.type?.name || col.column?.type || "VARCHAR",
        args: col.column?.args,
        name,
        table: tableDef.name,
        primary: col.column?.primaryKey,
        notNull: !col.isOptional,
        default: col.column?.defaultValue,
      };
    }

    return tableDef;
  }

  private static getColumns(
    tableDef: any,
    options: EntitySchemaBuilderOptions,
  ): Record<string, ColumnDef> {
    let columns: Record<string, ColumnDef> = {};

    for (const [key, col] of Object.entries(tableDef.columns || {})) {
      const column = col as any;
      columns[key] = {
        type: column.type,
        length: column.args?.[0],
        notNull: column.notNull ?? !column.nullable,
        isPrimaryKey: column.primary,
        isGenerated: column.generated,
        primary: column.primary,
        args: column.args,
        default: column.default,
      };
    }

    if (options.include && options.include.length > 0) {
      columns = Object.fromEntries(
        Object.entries(columns).filter(([key]) =>
          options.include!.includes(key),
        ),
      );
    }

    if (options.exclude && options.exclude.length > 0) {
      columns = Object.fromEntries(
        Object.entries(columns).filter(
          ([key]) => !options.exclude!.includes(key),
        ),
      );
    }

    return columns;
  }

  private static columnToZod(
    name: string,
    column: ColumnDef,
    opts: { required: boolean; coerceToInt?: boolean },
  ): z.ZodTypeAny {
    const typeInfo = this.TYPE_MAP[column.type] || { zod: "string" };
    const upperType = column.type.toUpperCase();
    let zodType: z.ZodTypeAny;

    switch (typeInfo.zod) {
      case "number":
        if (
          opts.coerceToInt ||
          upperType === "INT" ||
          upperType === "INTEGER" ||
          upperType === "BIGINT"
        ) {
          zodType = z.coerce.number().int();
        } else {
          zodType = z.number();
        }
        break;

      case "boolean":
        zodType = z.boolean();
        break;

      case "any":
        zodType = z.any();
        break;

      case "string":
      default:
        if (upperType === "UUID") {
          zodType = z.string().uuid();
        } else if (
          (upperType === "VARCHAR" || upperType === "CHAR") &&
          name.toLowerCase().includes("email")
        ) {
          zodType = z.string().email();
        } else if (upperType === "TIMESTAMP" || upperType === "DATETIME") {
          zodType = z.string().datetime();
        } else if (upperType === "DATE") {
          zodType = z.string().date();
        } else {
          zodType = z.string();
        }

        const length =
          column.length ||
          (column.args && column.args.length > 0 ? column.args[0] : undefined);
        if (length && length > 0) {
          zodType = (zodType as z.ZodString).max(length);
        }

        break;
    }

    if (opts.required && column.notNull) {
      if ("min" in (zodType as object)) {
        zodType = (zodType as z.ZodString).min(1);
      }
    }

    if (column.default !== undefined) {
      zodType = (zodType as any).default(column.default);
    }

    return zodType;
  }

  private static columnToOpenApi(name: string, column: ColumnDef): any {
    const typeInfo = this.TYPE_MAP[column.type] || { zod: "string" };
    const upperType = column.type.toUpperCase();
    let schema: any = {};

    switch (typeInfo.zod) {
      case "number":
        schema = { type: "number" };
        if (upperType === "INT" || upperType === "INTEGER") {
          schema.type = "integer";
          schema.format = "int32";
        } else if (upperType === "BIGINT") {
          schema.type = "integer";
          schema.format = "int64";
        }
        break;

      case "boolean":
        schema = { type: "boolean" };
        break;

      case "any":
        schema = {};
        break;

      case "string":
      default:
        schema = { type: "string" };
        if (upperType === "UUID") {
          schema.format = "uuid";
        } else if (
          (upperType === "VARCHAR" || upperType === "CHAR") &&
          name.toLowerCase().includes("email")
        ) {
          schema.format = "email";
        } else if (upperType === "TIMESTAMP" || upperType === "DATETIME") {
          schema.format = "date-time";
        } else if (upperType === "DATE") {
          schema.format = "date";
        }

        const length =
          column.length ||
          (column.args && column.args.length > 0 ? column.args[0] : undefined);
        if (length && length > 0) {
          schema.maxLength = length;
        }
        break;
    }

    if (column.isPrimaryKey || column.primary || column.isGenerated) {
      schema.readOnly = true;
    }

    if (column.default !== undefined) {
      schema.default = column.default;
    }

    return schema;
  }
}
