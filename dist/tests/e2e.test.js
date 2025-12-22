import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { projectRoot, runTsNodeScript } from "./utils.js";
const BASE_URL = "http://localhost:3000";
let serverProcess;
beforeAll(async () => {
    await runTsNodeScript("src/cli/generate-swagger.ts");
    await runTsNodeScript("src/cli/generate-routes.ts");
    const proc = spawn(process.execPath, [path.join(projectRoot, "scripts", "run-example.js")], {
        cwd: projectRoot,
        stdio: ["pipe", "pipe", "pipe"],
    });
    serverProcess = proc;
    await waitForServerReady(serverProcess);
}, 30000);
afterAll(() => {
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill();
    }
});
describe("adorn-api example server", () => {
    it("lists users from the advanced endpoint", async () => {
        const response = await fetch(`${BASE_URL}/advanced/tenant-12/users?page=1&limit=5`);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body[0]).toMatchObject({
            id: "1",
            name: "Alice",
        });
    });
    it("returns user details from the user controller", async () => {
        const response = await fetch(`${BASE_URL}/users/abc?details=true`);
        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain("Getting user abc");
        expect(text).toContain("details: true");
    });
});
async function waitForServerReady(proc, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (proc.exitCode !== null) {
            throw new Error("Example server exited before becoming ready");
        }
        try {
            const response = await fetch(`${BASE_URL}/docs`);
            if (response.ok) {
                await response.text();
                return;
            }
        }
        catch {
            // ignore errors while the server is starting
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("Timed out waiting for the example server to become ready");
}
