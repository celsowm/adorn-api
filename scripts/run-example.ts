import { spawn, ChildProcess } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, readdirSync, statSync } from "fs";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  const candidates = [
    process.env.INIT_CWD,
    process.cwd(),
    __dirname,
    join(__dirname, ".."),
  ].filter((dir): dir is string => Boolean(dir));

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

function getExamples(): string[] {
  const examplesDir = join(repoRoot, "examples");
  if (!existsSync(examplesDir)) return [];
  return readdirSync(examplesDir).filter(name => {
    const path = join(examplesDir, name);
    return statSync(path).isDirectory();
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes("-l") || args.includes("--list")) {
    console.log("Available examples:");
    getExamples().forEach(ex => console.log(`  - ${ex}`));
    process.exit(0);
  }

  if (args.includes("-h") || args.includes("--help")) {
    console.log(`
Usage: npm run example <example-name>

Run an adorn-api example.

Examples:
  npm run example basic
  npm run example blog-platform
  npm run example task-manager

Options:
  -l, --list    List all available examples
  -h, --help    Show this help message
`);
    process.exit(0);
  }

  const example = args[0] || "basic";
  const examplePath = join(repoRoot, "examples", example);

  if (!existsSync(examplePath)) {
    if (process.env.ADORN_EXAMPLE_DEBUG === "1") {
      console.log("\nDebug info:");
      console.log(`  cwd: ${process.cwd()}`);
      console.log(`  initCwd: ${process.env.INIT_CWD || "(unset)"}`);
      console.log(`  __dirname: ${__dirname}`);
      console.log(`  repoRoot: ${repoRoot}`);
      console.log(`  examplePath: ${examplePath}`);
      console.log(`  examplesDirExists: ${existsSync(join(repoRoot, "examples"))}`);
    }
    console.error(`\n❌ Example "${example}" not found.\n`);
    console.log("Available examples:");
    getExamples().forEach(ex => console.log(`  - ${ex}`));
    process.exit(1);
  }

  const adornExampleScript = join(repoRoot, "scripts", "adorn-example.ts");
  
  const scriptArgs = ["tsx", adornExampleScript, example];

  console.log(`\n🚀 Running "${example}" example...\n`);

  const cmd = isWindows() ? "npx.cmd" : "npx";
  const child = spawn(cmd, scriptArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: isWindows(),
  });

  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });

  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
  });

  await new Promise<void>((resolve, reject) => {
    child.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

main();
