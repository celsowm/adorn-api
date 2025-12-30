#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createProgramFromConfig } from "./compiler/runner/createProgram.js";
import { scanControllers } from "./compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "./compiler/schema/openapi.js";
import { generateManifest } from "./compiler/manifest/emit.js";

const args = process.argv.slice(2);
const command = args[0];

if (command === "build") {
  const projectIndex = args.indexOf("-p");
  const projectPath = projectIndex !== -1 ? args[projectIndex + 1] : "./tsconfig.json";
  const outputDir = args.includes("--output") 
    ? args[args.indexOf("--output") + 1] 
    : ".adorn";

  console.log(`Building from ${projectPath}...`);

  const { program, checker, sourceFiles } = createProgramFromConfig(projectPath);
  const controllers = scanControllers(sourceFiles, checker);

  if (controllers.length === 0) {
    console.warn("No controllers found!");
    process.exit(1);
  }

  console.log(`Found ${controllers.length} controller(s)`);

  const openapi = generateOpenAPI(controllers, checker, { title: "API", version: "1.0.0" });
  const manifest = generateManifest(controllers, checker, "0.1.0");

  const outputPath = resolve(outputDir);
  mkdirSync(outputPath, { recursive: true });

  writeFileSync(resolve(outputPath, "openapi.json"), JSON.stringify(openapi, null, 2));
  writeFileSync(resolve(outputPath, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`Written to ${outputPath}/`);
  console.log("  - openapi.json");
  console.log("  - manifest.json");

} else {
  console.log(`
adorn-api CLI

Commands:
  build     Generate OpenAPI and manifest from TypeScript source
  
Options:
  -p <path>     Path to tsconfig.json (default: ./tsconfig.json)
  --output <dir>  Output directory (default: .adorn)

Example:
  adorn-api build -p ./tsconfig.json --output .adorn
`);
}
