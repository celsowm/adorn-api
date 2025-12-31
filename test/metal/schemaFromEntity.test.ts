import { describe, it, expect } from "vitest";
import { ensureSymbolMetadata } from "../../src/metal/symbolMetadata.js";
import { schemaFromEntity } from "../../src/metal/schemaFromEntity.js";
import { registerMetalEntities } from "../../src/metal/registerMetalEntities.js";

describe("adorn-api/metal schemaFromEntity", () => {
  it("reads Symbol.metadata metal bag and emits JSON Schema", () => {
    class UserEntity {}

    const metaSym = ensureSymbolMetadata();

    Object.defineProperty(UserEntity, metaSym, {
      configurable: true,
      value: {
        "metal-orm:decorators": {
          columns: [
            { propertyName: "id", column: { type: "int", notNull: true, primary: true } },
            { propertyName: "name", column: { type: "varchar", args: [100], notNull: true } },
            { propertyName: "phone", column: { type: "varchar", args: [20], notNull: false } }
          ],
          relations: []
        }
      }
    });

    const s = schemaFromEntity(UserEntity, { mode: "read", stripEntitySuffix: false });
    expect(s?.type).toBe("object");
    expect(s?.properties?.id?.type).toBe("integer");
    expect(s?.properties?.name?.maxLength).toBe(100);
    expect(s?.properties?.phone?.type).toContain("null");
    expect(s?.required).toEqual(["id", "name"]);
    expect(s?.properties?.id?.readOnly).toBe(true);
  });

  it("registerMetalEntities merges into openapi.components.schemas", () => {
    class UserEntity {}

    const metaSym = ensureSymbolMetadata();
    Object.defineProperty(UserEntity, metaSym, {
      configurable: true,
      value: {
        "metal-orm:decorators": {
          columns: [{ propertyName: "id", column: { type: "int", notNull: true, primary: true } }],
          relations: []
        }
      }
    });

    const openapi: any = { openapi: "3.1.0", info: { title: "x", version: "1" } };
    registerMetalEntities(openapi, [UserEntity], { stripEntitySuffix: false });

    expect(openapi.components.schemas.UserEntity).toBeTruthy();
    expect(openapi.components.schemas.UserEntity.properties.id.type).toBe("integer");
  });

  it("mode=create excludes generated columns like primary/autoIncrement", () => {
    class UserEntity {}
    const metaSym = ensureSymbolMetadata();
    Object.defineProperty(UserEntity, metaSym, {
      configurable: true,
      value: {
        "metal-orm:decorators": {
          columns: [
            { propertyName: "id", column: { type: "int", notNull: true, primary: true, autoIncrement: true } },
            { propertyName: "name", column: { type: "varchar", args: [50], notNull: true } }
          ],
          relations: []
        }
      }
    });

    const s = schemaFromEntity(UserEntity, { mode: "create", stripEntitySuffix: false });
    expect(s?.properties?.id).toBeUndefined();
    expect(s?.required).toEqual(["name"]);
  });
});
