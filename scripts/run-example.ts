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
    
    // execSync works cross-platform (Windows/Linux/macOS)
    // It automatically uses the appropriate shell for each platform
    const command = "npm run dev";
    
    try {
      execSync(command, {
        cwd: examplePath,
        stdio: "inherit",
      });
    } catch (error) {
      // User pressed Ctrl+C, which is expected
      if ((error as any).signal === "SIGINT") {
        process.exit(0);
      }
      throw error;
    }
  } catch (err: any) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
