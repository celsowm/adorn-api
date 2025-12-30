import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/!(staleness).test.ts"],
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.json",
    },
  },
});
