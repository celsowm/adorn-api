import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const example = process.argv[2] || "basic";
const examplePath = join(__dirname, "..", "examples", example);

console.log(`\n🚀 Running "${example}" example...\n`);

try {
  console.log("📦 Building artifacts...");
  execSync("npm run build", { cwd: examplePath, stdio: "inherit" });

  console.log("🌐 Starting server...\n");
  const server = spawn("npm.cmd", ["run", "dev"], {
    cwd: examplePath,
    stdio: "inherit",
  });

  server.on("error", (err) => {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });

  console.log(`\n✅ Server running at http://localhost:3000/docs\n`);
  console.log("Press Ctrl+C to stop\n");

  process.on("SIGINT", () => {
    server.kill();
    process.exit(0);
  });
} catch (err: any) {
  console.error(`\n❌ Error: ${err.message}`);
  process.exit(1);
}
