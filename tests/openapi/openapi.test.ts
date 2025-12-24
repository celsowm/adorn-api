import { describe, it, expect } from "vitest";
import { generateOpenApi } from "../../src/index.js";
import { UsersController } from "../e2e/controllers/users.controller.js";

describe("openapi generator", () => {
  it("generates OpenAPI 3.1 spec", () => {
    const spec = generateOpenApi([UsersController], { title: "adorn-api", version: "0.0.1" });

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/users/{id}"]).toBeTruthy();
    expect(spec.paths["/users/{id}"].get).toBeTruthy();

    // stable components
    expect(spec.components.schemas.UserParams).toBeTruthy();
    expect(spec.components.schemas.UserResponse).toBeTruthy();

    // include param rendered
    const params = spec.paths["/users/{id}"].get.parameters;
    const include = params.find((p: any) => p.name === "include" && p.in === "query");
    expect(include.schema.type).toBe("array");
    expect(include.schema.items.enum).toEqual(["posts"]);
  });
});
