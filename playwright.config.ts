import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Same test environment as Vitest: .env.test (test database on port 3100).
Object.assign(process.env, { NODE_ENV: "test" });
loadEnvConfig(process.cwd());

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    locale: "es-PY",
    timezoneId: "America/Asuncion",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // A production build: closest to real behavior (Cache Components, prefetching).
    command: `npx next build && npx next start -p ${PORT}`,
    url: baseURL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
      EMAIL_TRANSPORT: "console",
      NODE_ENV: "production",
      AUTH_RATE_LIMIT: "off",
    },
  },
});
