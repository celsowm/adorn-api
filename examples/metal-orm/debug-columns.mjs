import "reflect-metadata";
import { bootstrapEntities, getTableDefFromEntity } from "metal-orm";
import { User } from "./src/entities.js";

// Inline getColumns function to debug
function getColumns(tableDef, options) {
  let columns = {};
  for (const [key, col] of Object.entries(tableDef.columns || {})) {
    const column = col;
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
    console.log(
      `[DEBUG] Column ${key}: primary=${column.primary}, isPrimaryKey=${columns[key].isPrimaryKey}`,
    );
  }
  return columns;
}

bootstrapEntities();

const tableDef = getTableDefFromEntity(User);
console.log("\n=== Table Def ===");
console.log("id primary:", tableDef?.columns?.id?.primary);

console.log("\n=== getColumns result ===");
const columns = getColumns(tableDef, {});
console.log("columns.id.isPrimaryKey:", columns["id"]?.isPrimaryKey);
