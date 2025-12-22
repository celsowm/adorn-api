import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loader = pathToFileURL(path.join(projectRoot, "node_modules", "ts-node", "esm.mjs")).toString();
const server = path.join(projectRoot, "tests", "example-app", "server.ts");

const child = spawn(
  process.execPath,
  ["--loader", loader, server],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      TS_NODE_PROJECT: path.join(projectRoot, "tsconfig.json"),
      TS_NODE_PREFER_TS_EXTS: "true",
    },
  }
);

["SIGINT", "SIGTERM"].forEach(signal => {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
});

child.on("exit", code => {
  process.exitCode = code ?? 0;
});
