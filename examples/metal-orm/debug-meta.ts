import "reflect-metadata";
import {
  bootstrapEntities,
  getDecoratorMetadata,
  getTableDefFromEntity,
} from "metal-orm";
import { User } from "./src/entities.js";

console.log("Before bootstrap");

bootstrapEntities();

console.log("After bootstrap");
console.log("getTableDefFromEntity(User):", getTableDefFromEntity(User));
console.log(
  "User metadata keys:",
  Object.keys((User as any).Symbol?.metadata || {}),
);

const decoratorMeta = getDecoratorMetadata(User);
console.log("getDecoratorMetadata(User):", decoratorMeta);
