Executive Summary
The adorn-api project is a conceptual prototype that is currently not production-ready or functional. While it demonstrates a clear intent to create a NestJS-like developer experience (decorators + TypeScript) on top of Express, it suffers from critical "build-breaking" errors, a complete lack of runtime safety, and foundational architectural flaws that prevent it from being a viable framework in its current state.

Below is the consolidated review, categorized by severity.

1. Critical Functional & Build Failures
These issues prevent the code from compiling, running, or behaving as expected.

Missing Exports (Build Breakers):

Core Modules: Many files define functionality but fail to export it. For example, src/decorators/routes.ts defines functions like Get and Post but does not export them, causing src/decorators/index.ts to fail when attempting to re-export them .


Generated Code: The code generator emits a routes.ts file containing function RegisterRoutes(...) but does not mark it as export. This causes the generated code to be unusable by the consumer application (as seen in tests/e2e/helpers.ts trying to import it ).


Broken Relative Imports:

The getRelativePath utility contains a bug where files in the same directory return a bare string (e.g., "UsersController") instead of a relative path (e.g., "./UsersController"). Node.js treats the former as a package import, causing runtime crashes.

Empty Stub Modules:

Essential advertised features exist only as empty files (export {};). This includes the validation adapters (src/adapters/validation/zod.ts) , authentication decorators (src/decorators/auth.ts), and error mappers.


2. Runtime Safety & Security Vulnerabilities
Despite using TypeScript, the framework offers zero runtime safety, leading to "stringly-typed" instability and security risks.

No Runtime Validation (The "Zod" Illusion):

Although zod is listed in package.json, it is never used in the source code. The framework relies entirely on TypeScript for static analysis.



Impact: At runtime, req.body is spread directly into the DTO. If a user sends a string to a field typed as number, it passes through unchecked, likely crashing the application later.

Mass Assignment Vulnerability:

By spreading ...req.body directly into the controller arguments, the framework allows malicious users to inject properties that exist on the DTO but should not be exposed (e.g., isAdmin, internalFlags).

Missing Type Coercion:

Inputs from req.query and req.params are not converted. A route expecting a number (page: number) will receive a string ("1"), causing logic errors (e.g., page + 1 becomes "11").

Crash Risk:

The generated code executes Object.entries(req.body) without checking if req.body exists. If express.json() middleware is missing or the body is empty/undefined, the server will crash.

3. OpenAPI & Documentation Flaws
The OpenAPI generation is structurally invalid and incomplete.

Missing Schema Definitions:

The generator emits references (e.g., $ref: '#/components/schemas/UserDto')  but never generates the definition. The components.schemas object is never populated in emitOpenapiJson, rendering the Swagger UI broken.


Incomplete Spec:

Responses are hardcoded to generic { type: 'object' } schemas.

It fails to document Query parameters, Headers, or Cookies—only Path parameters are emitted.

4. Architectural Design Limitations
The design choices limit scalability and modern development practices.

Brittle Decorator Parsing:

The framework disables emitDecoratorMetadata in tsconfig.json.

Instead of reflection, it uses regex (getText().replace(...)) to parse arguments. This is extremely fragile; passing a variable, constant, or template literal to a decorator will break the parser.

No Dependency Injection (DI):

Controllers are instantiated using new Class() inside every request handler.

Impact: You cannot inject services (DB, Logger, Auth) into controllers, forcing the use of global state or singletons.

The "Mega-DTO" Bottleneck:

The framework forces all inputs (Query, Body, Params) into a single object argument. You cannot use standard patterns like find(@Query('id') id: string).

Global State Leakage:

Tests rely on global Map objects (usersStore) defined at the module level. This causes test pollution, where data from one test persists into another, leading to flaky CI pipelines.

5. Configuration & DevOps Issues

Outdated Dependencies: Key libraries like express (^4.18.0) and @types/node (^20.x) are outdated relative to the projected date (Dec 2025), potentially missing security patches.



Misconfigured ESLint: The config only targets .ts files and lacks TypeScript-specific rules (@typescript-eslint), allowing loose typing to proliferate.


Bloated Lockfile: The lockfile is filled with platform-specific @esbuild binaries that may not be necessary for the project's scope .

Recommended "High Leverage" Fixes
To move this from a broken prototype to a working alpha, prioritize these steps:

Fix the Build:

Add export to src/decorators/routes.ts.

Update src/codegen/emit/express.ts to export RegisterRoutes.

Patch getRelativePath to ensure local imports start with ./.

Implement Runtime Safety:

Integrate zod to generate schemas from DTOs.

Update the generator to validate req.body against the schema before passing it to the controller.

Fix OpenAPI Components:

Implement the missing logic to scan DTO properties and populate components.schemas.

Refactor Architecture:

Switch from regex-based parsing to proper AST analysis or enable emitDecoratorMetadata.