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
    console.log(`\n✅ Server running at http://localhost:3000/docs\n`);
    console.log("Press Ctrl+C to stop\n");
    
    const child = spawn("npm", ["run", "dev"], {
      cwd: examplePath,
      stdio: "inherit",
      shell: true,
    });

    // Handle signals properly
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
  } catch (err: any) {
    if (err.code !== "SIGINT" && err.code !== "SIGTERM") {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    }
  }
}

main();
