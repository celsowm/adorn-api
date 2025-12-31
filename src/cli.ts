#!/usr/bin/env node
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createProgramFromConfig } from "./compiler/runner/createProgram.js";
import { scanControllers } from "./compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "./compiler/schema/openapi.js";
import { generateManifest } from "./compiler/manifest/emit.js";
import { emitPrecompiledValidators } from "./compiler/validation/emitPrecompiledValidators.js";
import { isStale } from "./compiler/cache/isStale.js";
import { writeCache } from "./compiler/cache/writeCache.js";
import ts from "typescript";
import process from "node:process";

const ADORN_VERSION = "0.1.0";

type ValidationMode = "none" | "ajv-runtime" | "precompiled";

function log(msg: string) {
  process.stdout.write(msg + "\n");
}

function debug(...args: unknown[]) {
  if (process.env.ADORN_DEBUG) {
    console.error("[adorn-api]", ...args);
  }
}

async function buildCommand(args: string[]) {
  const projectIndex = args.indexOf("-p");
  const projectPath = projectIndex !== -1 ? args[projectIndex + 1] : "./tsconfig.json";
  const outputDir = args.includes("--output")
    ? args[args.indexOf("--output") + 1]
    : ".adorn";
  const ifStale = args.includes("--if-stale");
  
  const validationModeIndex = args.indexOf("--validation-mode");
  const validationMode: ValidationMode = validationModeIndex !== -1 
    ? (args[validationModeIndex + 1] as ValidationMode) 
    : "ajv-runtime";

  if (validationMode !== "none" && validationMode !== "ajv-runtime" && validationMode !== "precompiled") {
    console.error(`Invalid validation mode: ${validationMode}. Valid values: none, ajv-runtime, precompiled`);
    process.exit(1);
  }

  const outputPath = resolve(outputDir);

  if (ifStale) {
    const stale = await isStale({
      outDir: outputDir,
      project: projectPath,
      adornVersion: ADORN_VERSION,
      typescriptVersion: ts.version
    });

    if (!stale.stale) {
      log("adorn-api: artifacts up-to-date");
      return;
    }

    log(`adorn-api: building artifacts (reason: ${stale.reason}${stale.detail ? `: ${stale.detail}` : ""})`);
    debug("Stale detail:", stale.detail);
  } else {
    log("adorn-api: building artifacts (reason: forced-build)");
  }

  const { program, checker, sourceFiles } = createProgramFromConfig(projectPath);
  const controllers = scanControllers(sourceFiles, checker);

  if (controllers.length === 0) {
    console.warn("No controllers found!");
    process.exit(1);
  }

  log(`Found ${controllers.length} controller(s)`);

  const openapi = generateOpenAPI(controllers, checker, { title: "API", version: "1.0.0" });
  const manifest = generateManifest(controllers, checker, ADORN_VERSION, validationMode);

  mkdirSync(outputPath, { recursive: true });

  writeFileSync(resolve(outputPath, "openapi.json"), JSON.stringify(openapi, null, 2));
  writeFileSync(resolve(outputPath, "manifest.json"), JSON.stringify(manifest, null, 2));

  if (validationMode === "precompiled") {
    log("Generating precompiled validators...");
    
    const manifestObj = JSON.parse(readFileSync(resolve(outputPath, "manifest.json"), "utf-8"));
    
    await emitPrecompiledValidators({
      outDir: outputPath,
      openapi,
      manifest: manifestObj,
      strict: "off",
      formatsMode: "full"
    });

    manifestObj.validation = {
      mode: "precompiled",
      precompiledModule: "./validators.mjs"
    };
    
    writeFileSync(resolve(outputPath, "manifest.json"), JSON.stringify(manifestObj, null, 2));
    
    log("  - validators.cjs");
    log("  - validators.mjs");
    log("  - validators.meta.json");
  }

  writeCache({
    outDir: outputDir,
    tsconfigAbs: resolve(projectPath),
    program,
    adornVersion: ADORN_VERSION
  });

  log(`Written to ${outputPath}/`);
  log("  - openapi.json");
  log("  - manifest.json");
  log("  - cache.json");
}

function cleanCommand(args: string[]) {
  const outputDir = args.includes("--output")
    ? args[args.indexOf("--output") + 1]
    : ".adorn";

  const outputPath = resolve(outputDir);

  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true, force: true });
  }

  log(`adorn-api: cleaned ${outputDir}`);
}

const command = process.argv[2];

if (command === "build") {
  buildCommand(process.argv.slice(3)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (command === "clean") {
  cleanCommand(process.argv.slice(3));
} else {
  console.log(`
adorn-api CLI

Commands:
  build     Generate OpenAPI and manifest from TypeScript source
  clean     Remove generated artifacts

Options:
  -p <path>                Path to tsconfig.json (default: ./tsconfig.json)
  --output <dir>           Output directory (default: .adorn)
  --if-stale               Only rebuild if artifacts are stale
  --validation-mode <mode> Validation mode: none, ajv-runtime, precompiled (default: ajv-runtime)

Examples:
  adorn-api build -p ./tsconfig.json --output .adorn
  adorn-api build --if-stale
  adorn-api build --validation-mode precompiled
  adorn-api clean
  `);
}
