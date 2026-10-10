import { fileURLToPath } from "node:url";

import nextEnv from "@next/env";
import { defineConfig } from "vitest/config";

// Load .env.test (+ .env) like Next.js does in the test environment.
Object.assign(process.env, { NODE_ENV: "test" });
nextEnv.loadEnvConfig(process.cwd());

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: root },
      // `server-only` throws outside React Server Components.
      { find: "server-only", replacement: `${root}tests/stubs/server-only.ts` },
    ],
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          // Tests share one database.
          fileParallelism: false,
        },
      },
    ],
  },
});
