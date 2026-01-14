import "reflect-metadata";
console.log("[TEST] Symbol:", typeof Symbol);
console.log("[TEST] Symbol.metadata:", typeof Symbol.metadata);
console.log("[TEST] Reflect.metadata:", typeof Reflect.metadata);

// Try to create a decorated class
function MyDecorator(target, propertyKey) {
  console.log("[TEST] Decorator called with:", propertyKey);
  console.log("[TEST] Target:", target);
  console.log("[TEST] Target[Symbol.metadata]:", target[Symbol.metadata]);
}

class TestClass {
  @MyDecorator
  myProperty: string = "test";
}

const symbols = Object.getOwnPropertySymbols(TestClass);
console.log("[TEST] TestClass symbols:", symbols.map(s => s.description));
