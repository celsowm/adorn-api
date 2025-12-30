#!/usr/bin/env node
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createProgramFromConfig } from "./compiler/runner/createProgram.js";
import { scanControllers } from "./compiler/analyze/scanControllers.js";
import { generateOpenAPI } from "./compiler/schema/openapi.js";
import { generateManifest } from "./compiler/manifest/emit.js";
import { isStale } from "./compiler/cache/isStale.js";
import { writeCache } from "./compiler/cache/writeCache.js";
import ts from "typescript";
import process from "node:process";

const ADORN_VERSION = "0.1.0";

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
  const manifest = generateManifest(controllers, checker, ADORN_VERSION);

  mkdirSync(outputPath, { recursive: true });

  writeFileSync(resolve(outputPath, "openapi.json"), JSON.stringify(openapi, null, 2));
  writeFileSync(resolve(outputPath, "manifest.json"), JSON.stringify(manifest, null, 2));

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
  -p <path>       Path to tsconfig.json (default: ./tsconfig.json)
  --output <dir>  Output directory (default: .adorn)
  --if-stale     Only rebuild if artifacts are stale

Examples:
  adorn-api build -p ./tsconfig.json --output .adorn
  adorn-api build --if-stale
  adorn-api clean
`);
}
