import "reflect-metadata";
import { User } from "./entities.js";

console.log(
  "[TEST] Symbol.metadata available:",
  typeof Symbol !== "undefined" && typeof Symbol.metadata !== "undefined",
);
console.log(
  "[TEST] User prototype symbols:",
  Object.getOwnPropertySymbols(User.prototype),
);
console.log("[TEST] User static symbols:", Object.getOwnPropertySymbols(User));

// Try to access metadata directly
try {
  const metadata = User[Symbol.metadata];
  console.log("[TEST] User[Symbol.metadata]:", metadata);
} catch (e) {
  console.log("[TEST] Error accessing Symbol.metadata:", e.message);
}
