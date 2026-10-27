import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // `import "server-only"` throws outside a React Server bundle; under Vitest it resolves to an empty module.
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) },
      { find: /^@\//, replacement: root },
    ],
  },
  test: {
    // Pure logic, content guards and static-markup component tests, all in node (plan §19.1).
    include: ["lib/**/*.test.ts", "content/**/*.test.ts", "components/**/*.test.{ts,tsx}", "tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
