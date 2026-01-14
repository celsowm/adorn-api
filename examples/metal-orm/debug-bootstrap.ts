import "reflect-metadata";
import {
  getDecoratorMetadata,
  bootstrapEntities,
  getTableDefFromEntity,
} from "metal-orm";
import { User } from "./src/entities.js";

console.log("Before bootstrap:");
console.log("  User:", User);
console.log("  User.tableDef:", (User as any).tableDef);
console.log("  getTableDefFromEntity(User):", getTableDefFromEntity(User));
console.log("  getDecoratorMetadata(User):", getDecoratorMetadata(User));

bootstrapEntities();

console.log("After bootstrap:");
console.log("  User.tableDef:", (User as any).tableDef);
console.log("  getTableDefFromEntity(User):", getTableDefFromEntity(User));
console.log("  getDecoratorMetadata(User):", getDecoratorMetadata(User));
