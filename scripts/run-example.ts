import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const example = process.argv[2] || "basic";
  const examplePath = join(__dirname, "..", "examples", example);

  console.log(`\n🚀 Running "${example}" example...\n`);

  try {
    const nodeModulesExists = existsSync(join(examplePath, "node_modules"));
    
    if (!nodeModulesExists) {
      console.log("📦 Installing dependencies...");
      execSync("npm install", { cwd: examplePath, stdio: "inherit" });
    }

    console.log("📦 Building artifacts...");
    execSync("npm run build", { cwd: examplePath, stdio: "inherit" });

    console.log("🌐 Starting server...\n");
    const isWindows = process.platform === "win32";
    const cmd = isWindows ? "npm.cmd" : "npm";
    const server = spawn(cmd, ["run", "dev"], {
      cwd: examplePath,
      stdio: "inherit",
      shell: true,
      windowsHide: true,
    });

    server.on("error", (err) => {
      console.error(`Failed to start server: ${err.message}`);
      process.exit(1);
    });

    console.log(`\n✅ Server running at http://localhost:3000/docs\n`);
    console.log("Press Ctrl+C to stop\n");

    process.on("SIGINT", () => {
      server.kill("SIGTERM");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      server.kill("SIGTERM");
      process.exit(0);
    });

    server.on("close", (code) => {
      process.exit(code);
    });
  } catch (err: any) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
