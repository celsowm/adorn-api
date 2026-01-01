import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, readdirSync, statSync } from "fs";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function isWindows(): boolean {
  return process.platform === "win32";
}

function getExamples(): string[] {
  const examplesDir = join(__dirname, "..", "examples");
  if (!existsSync(examplesDir)) return [];
  return readdirSync(examplesDir).filter(name => {
    const path = join(examplesDir, name);
    return statSync(path).isDirectory();
  });
}

function main(): void {
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
  const examplePath = join(__dirname, "..", "examples", example);

  if (!existsSync(examplePath)) {
    console.error(`\n❌ Example "${example}" not found.\n`);
    console.log("Available examples:");
    getExamples().forEach(ex => console.log(`  - ${ex}`));
    process.exit(1);
  }

  const adornExampleScript = join(__dirname, "adorn-example.ts");
  
  const scriptArgs = ["tsx", adornExampleScript, example];

  console.log(`\n🚀 Running "${example}" example...\n`);

  const cmd = isWindows() ? "npx.cmd" : "npx";
  const result = spawnSync(cmd, scriptArgs, {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
  shell: isWindows(),
  });

  process.exit(result.status || 0);
}

main();
