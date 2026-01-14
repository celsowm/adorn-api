import "reflect-metadata";
import { bootstrapEntities, getTableDefFromEntity } from "metal-orm";
import { User } from "./src/entities.js";

const symbols = Object.getOwnPropertySymbols(User);
for (const sym of symbols) {
  if (sym.description === "Symbol.metadata") {
    const metadata = User[sym];
    const decorators = metadata?.["metal-orm:decorators"];
    console.log("decorators:", JSON.stringify(decorators, null, 2));
  }
}
