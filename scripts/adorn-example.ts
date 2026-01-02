#!/usr/bin/env node

/**
 * Adorn-API Example Runner
 * 
 * Usage:
 *   npx adorn-example <example-name>
 *   npx adorn-example blog-platform
 *   npx adorn-example task-manager
 * 
 * Or from the adorn-api project root:
 *   npm run example <example-name>
 */

import { execSync, spawn, ChildProcess } from "child_process";
import { dirname, join } from "path";
import { existsSync, readdirSync, statSync } from "fs";
import process from "node:process";

function findRepoRoot(startDir: string): string | null {
  let current = startDir;
  while (true) {
    const examplesDir = join(current, "examples");
    const packageJson = join(current, "package.json");
    if (existsSync(examplesDir) && existsSync(packageJson)) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function resolveRepoRoot(): string {
  const candidates = [process.env.INIT_CWD, process.cwd()].filter(
    (dir): dir is string => Boolean(dir),
  );

  for (const candidate of candidates) {
    const root = findRepoRoot(candidate);
    if (root) return root;
  }

  return process.cwd();
}

const repoRoot = resolveRepoRoot();

function isWindows(): boolean {
  return process.platform === "win32";
}

function runCommand(command: string, cwd: string): void {
  const shell = isWindows() ? "cmd.exe" : "/bin/bash";
  execSync(command, { cwd, stdio: "inherit", shell });
}

function spawnCommand(args: string[], cwd: string): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const cmd = isWindows() ? "npm.cmd" : "npm";
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: isWindows(),
    });

    child.on("error", reject);
    resolve(child);
  });
}

function getExamples(): string[] {
  const examplesDir = join(repoRoot, "examples");
  if (!existsSync(examplesDir)) return [];
  return readdirSync(examplesDir).filter(name => {
    const path = join(examplesDir, name);
    return statSync(path).isDirectory();
  });
}

function printHelp(): void {
  console.log(`
Usage: npx adorn-example <example-name>

Run an adorn-api example with automatic dependency installation.

Examples:
  npx adorn-example blog-platform
  npx adorn-example task-manager
  npx adorn-example basic

Available examples:
${getExamples().map(e => `  - ${e}`).join("\n")}

Options:
  -h, --help     Show this help message
  -l, --list     List all available examples

From the adorn-api project root, you can also use:
  npm run example <example-name>
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("-l") || args.includes("--list")) {
    console.log("Available examples:");
    getExamples().forEach(ex => console.log(`  - ${ex}`));
    process.exit(0);
  }

  const example = args[0] || "basic";
  const examplePath = join(repoRoot, "examples", example);

  if (!existsSync(examplePath)) {
    console.error(`\n❌ Example "${example}" not found.\n`);
    console.log("Available examples:");
    getExamples().forEach(ex => console.log(`  - ${ex}`));
    process.exit(1);
  }

  console.log(`\n🚀 Running "${example}" example...\n`);

  let child: ChildProcess | null = null;

  try {
    const nodeModulesPath = join(examplePath, "node_modules");
    const nodeModulesExists = existsSync(nodeModulesPath);

    if (!nodeModulesExists) {
      console.log("📦 Installing dependencies...");
      runCommand("npm install", examplePath);
    }

    console.log("📦 Building artifacts...");
    runCommand("npm run build", examplePath);

    console.log("🌐 Starting server...\n");
    console.log("Press Ctrl+C to stop\n");

    child = await spawnCommand(["run", "dev"], examplePath);

    process.on("SIGINT", () => {
      if (child) child.kill("SIGINT");
    });

    process.on("SIGTERM", () => {
      if (child) child.kill("SIGTERM");
    });

    await new Promise<void>((resolve, reject) => {
      if (!child) {
        reject(new Error("Child process not started"));
        return;
      }
      child.on("exit", (code) => {
        if (code === 0 || code === null) {
          resolve();
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
      child.on("error", reject);
    });
  } catch (err: any) {
    if (err.code !== "SIGINT" && err.code !== "SIGTERM") {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    }
  }
}

main();
