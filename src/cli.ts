#!/usr/bin/env node
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createProgramFromConfig } from "./compiler/runner/createProgram.js";
import { scanControllers } from "./compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "./compiler/schema/openapi.js";
import { generateManifest } from "./compiler/manifest/emit.js";
import { emitPrecompiledValidators } from "./compiler/validation/emitPrecompiledValidators.js";
import { isStale } from "./compiler/cache/isStale.js";
import { writeCache } from "./compiler/cache/writeCache.js";
import { ProgressTracker, Spinner } from "./cli/progress.js";
import ts from "typescript";
import process from "node:process";

const ADORN_VERSION = "0.1.0";

type ValidationMode = "none" | "ajv-runtime" | "precompiled";

interface BuildOptions {
  projectPath: string;
  outputDir: string;
  ifStale: boolean;
  validationMode: ValidationMode;
  verbose: boolean;
  quiet: boolean;
}

function log(msg: string, options?: { indent?: boolean }) {
  if (options?.indent) {
    process.stdout.write("  " + msg + "\n");
  } else {
    process.stdout.write(msg + "\n");
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileSize(path: string): number | undefined {
  try {
    return statSync(path).size;
  } catch {
    return undefined;
  }
}

function debug(...args: unknown[]) {
  if (process.env.ADORN_DEBUG) {
    console.error("[adorn-api]", ...args);
  }
}

function sanitizeForJson(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForJson(item));
  }
  
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key.startsWith("__@") || key.startsWith("[")) continue;
    if (typeof value === "function") continue;
    if (value !== null && typeof value === "object") {
      const typeName = (value as any).constructor?.name;
      if (typeName && !["Object", "Array", "String", "Number", "Boolean", "Date", "RegExp"].includes(typeName)) {
        continue;
      }
    }
    result[key] = sanitizeForJson(value);
  }
  return result;
}

async function buildCommand(args: string[]) {
  const progress = new ProgressTracker({ verbose: args.includes("--verbose"), quiet: args.includes("--quiet") });

  // Parse arguments
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

  const verbose = args.includes("--verbose");
  const quiet = args.includes("--quiet");

  if (validationMode !== "none" && validationMode !== "ajv-runtime" && validationMode !== "precompiled") {
    console.error(`Invalid validation mode: ${validationMode}. Valid values: none, ajv-runtime, precompiled`);
    process.exit(1);
  }

  const outputPath = resolve(outputDir);

  if (!quiet) {
    log(`adorn-api v${ADORN_VERSION} - Building API artifacts`);
    log("");
  }

  // Phase 1: Check staleness
  if (ifStale) {
    progress.startPhase("staleness-check", "Checking for stale artifacts");
    const stale = await isStale({
      outDir: outputDir,
      project: projectPath,
      adornVersion: ADORN_VERSION,
      typescriptVersion: ts.version
    });

    if (!stale.stale) {
      progress.completePhase("staleness-check");
      if (!quiet) {
        log("adorn-api: artifacts up-to-date");
      }
      return;
    }

    progress.completePhase("staleness-check", `Artifacts stale (${stale.reason})`);
    if (verbose) {
      progress.verboseLog(`Stale reason: ${stale.detail || stale.reason}`);
    }
  } else {
    progress.startPhase("configuration", "Initializing build");
    progress.completePhase("configuration", "Build forced (--if-stale not used)");
  }

  // Phase 2: Create TypeScript program
  progress.startPhase("program", "Loading TypeScript configuration");
  if (verbose) {
    progress.verboseLog(`Loading ${projectPath}`);
  }
  
  const { program, checker, sourceFiles } = createProgramFromConfig(projectPath);
  const projectSourceFiles = sourceFiles.filter(sf => !sf.fileName.includes("node_modules"));
  progress.completePhase("program");
  
  if (verbose) {
    progress.verboseLog(`Found ${projectSourceFiles.length} source files`);
  }

  // Phase 3: Scan controllers
  progress.startPhase("scan", "Scanning for controllers");
  const controllers = scanControllers(sourceFiles, checker);
  
  if (controllers.length === 0) {
    console.warn("No controllers found!");
    process.exit(1);
  }

  const totalOperations = controllers.reduce((sum, ctrl) => sum + ctrl.operations.length, 0);
  progress.completePhase("scan", `Found ${controllers.length} controller(s) with ${totalOperations} operation(s)`);
  
  if (verbose) {
    for (const ctrl of controllers) {
      progress.verboseLog(`Controller: ${ctrl.className} (${ctrl.basePath}) - ${ctrl.operations.length} operations`);
    }
  }

  // Phase 4: Generate OpenAPI
  progress.startPhase("openapi", "Generating OpenAPI schema");
  if (verbose) {
    progress.verboseLog("Processing schemas from type definitions");
  }
  
  const openapi = generateOpenAPI(controllers, checker, { title: "API", version: "1.0.0" });
  const schemaCount = Object.keys(openapi.components?.schemas || {}).length;
  progress.completePhase("openapi", `Generated ${schemaCount} schema(s)`);

  // Phase 5: Generate manifest
  progress.startPhase("manifest", "Generating manifest");
  const manifest = generateManifest(controllers, checker, ADORN_VERSION, validationMode);
  progress.completePhase("manifest");

  // Phase 6: Write artifacts
  progress.startPhase("write", "Writing artifacts");
  mkdirSync(outputPath, { recursive: true });
  
  const openapiPath = resolve(outputPath, "openapi.json");
  const manifestPath = resolve(outputPath, "manifest.json");
  
  writeFileSync(openapiPath, JSON.stringify(sanitizeForJson(openapi), null, 2));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  const artifacts: Array<{ name: string; size?: number }> = [
    { name: "openapi.json", size: getFileSize(openapiPath) },
    { name: "manifest.json", size: getFileSize(manifestPath) },
  ];
  
  if (verbose) {
    for (const artifact of artifacts) {
      progress.verboseLog(`Written: ${artifact.name} (${formatBytes(artifact.size || 0)})`);
    }
  }

  // Phase 7: Precompiled validators (if enabled)
  let validatorsPhase = false;
  if (validationMode === "precompiled") {
    progress.startPhase("validators", "Generating precompiled validators");
    validatorsPhase = true;
    
    const manifestObj = JSON.parse(readFileSync(manifestPath, "utf-8"));
    
    const spinner = new Spinner("Generating validators...");
    if (!quiet) spinner.start();
    
    await emitPrecompiledValidators({
      outDir: outputPath,
      openapi,
      manifest: manifestObj,
      strict: "off",
      formatsMode: "full"
    });
    
    if (!quiet) spinner.stop();
    
    manifestObj.validation = {
      mode: "precompiled",
      precompiledModule: "./validators.mjs"
    };
    
    writeFileSync(manifestPath, JSON.stringify(manifestObj, null, 2));
    
    const validatorsCjsPath = resolve(outputPath, "validators.cjs");
    const validatorsMjsPath = resolve(outputPath, "validators.mjs");
    const validatorsMetaPath = resolve(outputPath, "validators.meta.json");
    
    artifacts.push(
      { name: "validators.cjs", size: getFileSize(validatorsCjsPath) },
      { name: "validators.mjs", size: getFileSize(validatorsMjsPath) },
      { name: "validators.meta.json", size: getFileSize(validatorsMetaPath) }
    );
    
    progress.completePhase("validators");
    
    if (verbose) {
      progress.verboseLog("Precompiled validators generated successfully");
    }
  }

  // Phase 8: Write cache
  progress.startPhase("cache", "Writing cache");
  
  writeCache({
    outDir: outputDir,
    tsconfigAbs: resolve(projectPath),
    program,
    adornVersion: ADORN_VERSION
  });
  
  const cachePath = resolve(outputPath, "cache.json");
  artifacts.push({ name: "cache.json", size: getFileSize(cachePath) });
  
  progress.completePhase("cache");
  
  if (verbose) {
    progress.verboseLog(`Written: cache.json (${formatBytes(getFileSize(cachePath) || 0)})`);
  }

  // Print summary
  const stats = {
    controllers: controllers.length,
    operations: totalOperations,
    schemas: schemaCount,
    sourceFiles: projectSourceFiles.length,
    artifactsWritten: artifacts.map(a => a.name),
  };
  
  progress.printSummary(stats);
  progress.printArtifacts(artifacts);
}

function cleanCommand(args: string[]) {
  const quiet = args.includes("--quiet");
  const outputDir = args.includes("--output")
    ? args[args.indexOf("--output") + 1]
    : ".adorn";

  const outputPath = resolve(outputDir);

  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true, force: true });
  }

  if (!quiet) {
    log(`adorn-api: cleaned ${outputDir}`);
  }
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
adorn-api CLI v${ADORN_VERSION}

Commands:
  build     Generate OpenAPI and manifest from TypeScript source
  clean     Remove generated artifacts

Options:
  -p <path>                Path to tsconfig.json (default: ./tsconfig.json)
  --output <dir>           Output directory (default: .adorn)
  --if-stale               Only rebuild if artifacts are stale
  --validation-mode <mode> Validation mode: none, ajv-runtime, precompiled (default: ajv-runtime)
  --verbose                Show detailed progress information
  --quiet                  Suppress non-essential output

Examples:
  adorn-api build -p ./tsconfig.json --output .adorn
  adorn-api build --if-stale
  adorn-api build --validation-mode precompiled
  adorn-api build --verbose
  adorn-api clean
  `);
}
