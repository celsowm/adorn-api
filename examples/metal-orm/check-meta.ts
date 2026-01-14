import "reflect-metadata";
import { bootstrapEntities } from "metal-orm";
import { User } from "./src/entities.js";

console.log("Before bootstrap");
const metadata1 = (User as any)[Symbol.metadata];
console.log("metadata1:", metadata1);

bootstrapEntities();

console.log("After bootstrap");
const metadata2 = (User as any)[Symbol.metadata];
console.log("metadata2:", metadata2);
