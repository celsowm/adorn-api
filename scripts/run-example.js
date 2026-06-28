const { spawnSync } = require("child_process");
const { existsSync, readdirSync, statSync } = require("fs");
const { resolve } = require("path");

const examplesDir = resolve(__dirname, "..", "examples");
const exampleName = process.argv[2] || "basic";
const entry = resolve(examplesDir, exampleName, "index.ts");

if (!existsSync(entry)) {
  const examples = readdirSync(examplesDir)
    .filter((name) => statSync(resolve(examplesDir, name)).isDirectory())
    .sort();
  console.error(`Example "${exampleName}" not found.`);
  console.error(`Available examples: ${examples.join(", ") || "none"}`);
  process.exit(1);
}

const tsxCommand = "tsx";
const result = spawnSync(tsxCommand, [entry], {
  stdio: "inherit",
  shell: process.platform === "win32"
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
