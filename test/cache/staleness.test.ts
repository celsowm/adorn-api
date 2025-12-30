import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("build --if-stale", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "adorn-stale-"));
  });

  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("first run builds artifacts", () => {
    const project = path.resolve(projectRoot, "test/fixtures/users/tsconfig.json");
    const adornVersion = "0.1.0";

    execSync(`node ${path.join(projectRoot, "dist/cli.js")} build -p ${project} --output ${tmpDir}`, {
      cwd: projectRoot,
      stdio: "pipe",
    });

    expect(fs.existsSync(path.join(tmpDir, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "cache.json"))).toBe(true);
  });

  it("second run skips when unchanged", () => {
    const project = path.resolve(projectRoot, "test/fixtures/users/tsconfig.json");

    const output = execSync(
      `node ${path.join(projectRoot, "dist/cli.js")} build -p ${project} --output ${tmpDir} --if-stale`,
      { cwd: projectRoot, encoding: "utf-8" }
    );

    expect(output).toContain("adorn-api: artifacts up-to-date");
    expect(fs.existsSync(path.join(tmpDir, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "cache.json"))).toBe(true);
  });

  it("rebuilds after input file change", async () => {
    const project = path.resolve(projectRoot, "test/fixtures/users/tsconfig.json");
    const controller = path.resolve(projectRoot, "test/fixtures/users/src/controller.ts");

    const now = new Date();
    fs.utimesSync(controller, now, now);

    await sleep(10);

    const output = execSync(
      `node ${path.join(projectRoot, "dist/cli.js")} build -p ${project} --output ${tmpDir} --if-stale`,
      { cwd: projectRoot, encoding: "utf-8" }
    );

    expect(output).toContain("adorn-api: building artifacts");
    expect(output).toContain("input-updated");
  });
});

describe("clean command", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "adorn-clean-"));
    fs.writeFileSync(path.join(tmpDir, "test.txt"), "test");
    fs.writeFileSync(path.join(tmpDir, "manifest.json"), "{}");
  });

  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("removes output directory contents", () => {
    expect(fs.existsSync(path.join(tmpDir, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "test.txt"))).toBe(true);

    const output = execSync(`node ${path.join(projectRoot, "dist/cli.js")} clean --output ${tmpDir}`, {
      cwd: projectRoot,
      encoding: "utf-8",
    });

    expect(output).toContain(`adorn-api: cleaned ${tmpDir}`);
    expect(fs.existsSync(path.join(tmpDir, "manifest.json"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, "test.txt"))).toBe(false);
  });
});
