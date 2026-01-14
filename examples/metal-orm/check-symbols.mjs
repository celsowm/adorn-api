import "reflect-metadata";
import { bootstrapEntities } from "metal-orm";
import { User } from "./entities.js";

console.log("[TEST] Starting test...");
bootstrapEntities();

const symbols = Object.getOwnPropertySymbols(User);
console.log(
  "[TEST] User symbols:",
  symbols.map((s) => s.description),
);

for (const sym of symbols) {
  if (sym.description === "Symbol.metadata") {
    const metadata = User[sym];
    console.log("[TEST] Found Symbol.metadata:", metadata);
  }
}
