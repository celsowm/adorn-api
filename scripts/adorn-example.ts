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
import * as readline from "readline";
import { isPortAvailable, findProcessOnPort, killProcess, waitForPort } from "../src/utils/port";

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
  -f, --force    Force kill process on port without prompting
  -p, --port     Specify port (default: 3000, env: ADORN_EXAMPLE_PORT)

From the adorn-api project root, you can also use:
  npm run example <example-name>
  `);
}

async function promptWithTimeout(question: string, timeout: number = 10000): Promise<string | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let timeoutId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<string | null>((resolve) => {
    timeoutId = setTimeout(() => {
      rl.close();
      console.log("\n⏰ Timed out waiting for input");
      resolve(null);
    }, timeout);
  });

  const inputPromise = new Promise<string>((resolve) => {
    rl.question(question, (answer) => {
      if (timeoutId) clearTimeout(timeoutId);
      rl.close();
      resolve(answer.trim());
    });
  });

  return Promise.race([inputPromise, timeoutPromise]);
}

async function ensurePortAvailable(targetPort: number, force: boolean): Promise<void> {
  console.log(`\n🔍 Checking port ${targetPort}...`);

  if (await isPortAvailable(targetPort)) {
    console.log(`✓ Port ${targetPort} is available`);
    return;
  }

  console.log(`❌ Port ${targetPort} is already in use.`);

  const processInfo = await findProcessOnPort(targetPort);
  
  if (!processInfo) {
    console.error("   Could not determine process using this port");
    console.error("   Please stop it manually or use a different port (ADORN_EXAMPLE_PORT env var)");
    process.exit(1);
  }

  const { pid, command } = processInfo;
  console.log(`   Process PID: ${pid}`);
  if (command) {
    console.log(`   Command: ${command}`);
  }

  if (force) {
    console.log(`\n   Force flag enabled, killing process ${pid}...`);
  } else {
    const answer = await promptWithTimeout("   Kill existing process? (y/n): ", 10000);

    if (answer === null) {
      console.log("\n❌ Aborted. Please stop the process manually or use a different port");
      process.exit(1);
    }

    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log("\n❌ Aborted. Please stop the process manually or use a different port");
      console.log("   You can also use the --force flag to auto-kill");
      process.exit(1);
    }
  }

  console.log(`   Terminating process ${pid}...`);
  if (await killProcess(pid)) {
    console.log("   ✓ Process killed successfully");

    console.log(`   Waiting for port ${targetPort} to be released...`);
    const released = await waitForPort(targetPort, "0.0.0.0", 3000);

    if (!released) {
      console.error(`\n❌ Port ${targetPort} still in use after killing process`);
      process.exit(1);
    }
    
    console.log(`   ✓ Port ${targetPort} is now available`);
  } else {
    console.error(`\n❌ Failed to kill process ${pid}`);
    console.error("   You may need to kill it manually or choose a different port");
    process.exit(1);
  }
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

  const forceFlag = args.includes("-f") || args.includes("--force");
  const portIndex = args.indexOf("-p") !== -1 ? args.indexOf("-p") : args.indexOf("--port");
  let targetPort = Number(process.env.ADORN_EXAMPLE_PORT || 3000);
  
  if (portIndex !== -1 && args[portIndex + 1]) {
    const portArg = Number(args[portIndex + 1]);
    if (!isNaN(portArg) && portArg > 0 && portArg <= 65535) {
      targetPort = portArg;
    } else {
      console.error(`\n❌ Invalid port number: ${args[portIndex + 1]}`);
      console.error("   Port must be between 1 and 65535");
      process.exit(1);
    }
  }

  const filteredArgs = args.filter(arg => 
    !["-f", "--force", "-p", "--port"].includes(arg) &&
    (portIndex === -1 || arg !== args[portIndex + 1])
  );

  const example = filteredArgs[0] || "basic";
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

    await ensurePortAvailable(targetPort, forceFlag);

    console.log("\n🌐 Starting server...\n");
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
