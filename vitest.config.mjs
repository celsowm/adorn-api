import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["dist/tests/setup/vitest.setup.js"],
    include: ["dist/tests/**/*.test.js"]
  }
});
