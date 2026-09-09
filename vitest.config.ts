import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // `server-only` throws when imported outside a server bundle; stub it so
      // server-only modules (e.g. lib/security/pin) are unit-testable.
      "server-only": resolve(__dirname, "src/test/empty-module.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // First dynamic import of a route module can exceed 5 s when the whole
    // suite runs in parallel on a loaded machine/CI runner.
    testTimeout: 20_000,
  },
});
