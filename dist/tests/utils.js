import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const projectRoot = path.resolve(__dirname, "..");
const tsNodeLoader = pathToFileURL(path.join(projectRoot, "node_modules", "ts-node", "esm.mjs")).toString();
export const tsNodeEnv = {
    ...process.env,
    TS_NODE_PROJECT: path.join(projectRoot, "tsconfig.json"),
    TS_NODE_PREFER_TS_EXTS: "true",
};
export function runTsNodeScript(relativePath, args = []) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(projectRoot, relativePath);
        const child = spawn(process.execPath, ["--loader", tsNodeLoader, scriptPath, ...args], {
            cwd: projectRoot,
            env: tsNodeEnv,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`Failed to run ${relativePath}\n${stderr}`));
        });
    });
}
