import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const fixtureRoot = resolve(__dirname, "fixtures/users");
const artifactsDir = resolve(fixtureRoot, ".adorn");
const projectRoot = resolve(__dirname, "..");

interface GeneratedManifest {
  manifestVersion: number;
  generatedAt: string;
  generator: { name: string; version: string; typescript: string };
  schemas: { kind: string; file: string; componentsSchemasPointer: string };
  validation: { mode: string; precompiledModule: null };
  controllers: Array<{
    controllerId: string;
    basePath: string;
    operations: Array<{
      operationId: string;
      http: { method: string; path: string };
      handler: { methodName: string };
      args: {
        body: { index: number; required: boolean; contentType: string; schemaRef: string } | null;
        path: Array<unknown>;
        query: Array<unknown>;
        headers: Array<unknown>;
      };
      responses: Array<{
        status: number;
        contentType: string;
        schemaRef: string;
        isArray?: boolean;
      }>;
    }>;
  }>;
}

beforeAll(() => {
  execSync("npx tsc -p tsconfig.json", { cwd: fixtureRoot, stdio: "inherit" });
  execSync(`npx tsx "${resolve(projectRoot, "src/cli.ts")}" build -p tsconfig.json --output .adorn`, {
    cwd: fixtureRoot,
    stdio: "inherit",
  });
});

describe("Compiler Build - Users Fixture", () => {
  it("should generate openapi.json matching golden snapshot", () => {
    const generatedOpenapi = JSON.parse(
      readFileSync(resolve(artifactsDir, "openapi.json"), "utf-8")
    );

    expect(generatedOpenapi.openapi).toBe("3.1.0");
    expect(generatedOpenapi.info.title).toBe("API");
    expect(generatedOpenapi.info.version).toBe("1.0.0");

    expect(generatedOpenapi.paths["/users/"]).toBeDefined();
    expect(generatedOpenapi.paths["/users/"]["get"]).toBeDefined();
    expect(generatedOpenapi.paths["/users/"]["post"]).toBeDefined();

    expect(generatedOpenapi.components.schemas["UserDto"]).toBeDefined();
    expect(generatedOpenapi.components.schemas["CreateUserPayload"]).toBeDefined();

    const userDtoSchema = generatedOpenapi.components.schemas["UserDto"];
    expect(userDtoSchema.properties?.id.type).toBe("number");
    expect(userDtoSchema.properties?.name.type).toBe("string");
    expect(userDtoSchema.properties?.phone.type).toContain("null");
    expect(userDtoSchema.properties?.role.enum).toEqual(["admin", "user"]);
    expect(userDtoSchema.required).toContain("id");
    expect(userDtoSchema.required).toContain("name");

    const createSchema = generatedOpenapi.components.schemas["CreateUserPayload"];
    expect(createSchema.properties?.joinedAt.type).toBe("string");
    expect(createSchema.properties?.joinedAt.format).toBe("date-time");

    expect(generatedOpenapi.paths["/users/"]["get"].operationId).toBe("UserController_getUsers");
    expect(generatedOpenapi.paths["/users/"]["post"].operationId).toBe("UserController_createUser");

    expect(generatedOpenapi.paths["/users/"]["get"].responses["200"]).toBeDefined();
    expect(generatedOpenapi.paths["/users/"]["post"].responses["201"]).toBeDefined();
    expect(generatedOpenapi.paths["/users/"]["post"].requestBody).toBeDefined();
  });

  it("should generate manifest.json matching golden snapshot", () => {
    const generatedManifest: GeneratedManifest = JSON.parse(
      readFileSync(resolve(artifactsDir, "manifest.json"), "utf-8")
    );

    expect(generatedManifest.manifestVersion).toBe(1);
    expect(generatedManifest.generatedAt).toBeDefined();
    expect(generatedManifest.generator.name).toBe("adorn-api");
    expect(generatedManifest.generator.version).toBe("0.1.0");
    expect(generatedManifest.schemas.kind).toBe("openapi-3.1");
    expect(generatedManifest.schemas.file).toBe("./openapi.json");
    expect(generatedManifest.schemas.componentsSchemasPointer).toBe("/components/schemas");

    expect(generatedManifest.controllers).toHaveLength(1);
    const controller = generatedManifest.controllers[0];
    expect(controller.controllerId).toBe("UserController");
    expect(controller.basePath).toBe("/users");
    expect(controller.operations).toHaveLength(3);

    const getOp = controller.operations.find(op => op.operationId === "UserController_getUsers");
    expect(getOp).toBeDefined();
    expect(getOp?.http.method).toBe("GET");
    expect(getOp?.http.path).toBe("/");
    expect(getOp?.handler.methodName).toBe("getUsers");
    expect(getOp?.args.body).toBeNull();
    expect(getOp?.responses).toHaveLength(1);
    expect(getOp?.responses[0].status).toBe(200);
    expect(getOp?.responses[0].schemaRef).toBe("#/components/schemas/UserDto");
    expect(getOp?.responses[0].isArray).toBe(true);

    const postOp = controller.operations.find(op => op.operationId === "UserController_createUser");
    expect(postOp).toBeDefined();
    expect(postOp?.http.method).toBe("POST");
    expect(postOp?.http.path).toBe("/");
    expect(postOp?.handler.methodName).toBe("createUser");
    expect(postOp?.args.body).not.toBeNull();
    expect(postOp?.args.body?.index).toBe(0);
    expect(postOp?.args.body?.required).toBe(true);
    expect(postOp?.args.body?.schemaRef).toBe("#/components/schemas/CreateUserPayload");
    expect(postOp?.responses).toHaveLength(1);
    expect(postOp?.responses[0].status).toBe(201);
    expect(postOp?.responses[0].schemaRef).toBe("#/components/schemas/UserDto");
  });

  it("should generate consistent schema refs between openapi and manifest", () => {
    const openapi = JSON.parse(readFileSync(resolve(artifactsDir, "openapi.json"), "utf-8"));
    const manifest: GeneratedManifest = JSON.parse(readFileSync(resolve(artifactsDir, "manifest.json"), "utf-8"));

    const schemaNames = Object.keys(openapi.components.schemas);
    expect(schemaNames).toContain("UserDto");
    expect(schemaNames).toContain("CreateUserPayload");

    const manifestRefs = new Set<string>();
    for (const ctrl of manifest.controllers) {
      for (const op of ctrl.operations) {
        manifestRefs.add(op.responses[0]?.schemaRef);
        if (op.args.body) {
          manifestRefs.add(op.args.body.schemaRef);
        }
      }
    }

    expect(manifestRefs.has("#/components/schemas/UserDto")).toBe(true);
    expect(manifestRefs.has("#/components/schemas/CreateUserPayload")).toBe(true);
  });
});
