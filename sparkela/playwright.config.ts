import { defineConfig, devices } from "@playwright/test";

import { TEST_ENV, TEST_PORT } from "./tests/test-env.mjs";

// Always TEST_PORT, never process.env.PORT: `npm run start:test` listens on 3200 whatever PORT a shell or CI sets.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${TEST_PORT}`;
// The container ships its own Chromium; never run `playwright install` there.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Two workers: the container has 4 cores and the production server runs alongside.
  workers: 2,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure", launchOptions: { executablePath } },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, launchOptions: { executablePath } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { executablePath } } },
  ],
  // Runs against a production build with the test clock (plan §19.3). With PLAYWRIGHT_BASE_URL set, the server must
  // already run via `npm run start:test`; a bare `next start` shows the waitlist everywhere before launch.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run build:test && npm run start:test",
        url: baseURL,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        env: TEST_ENV,
      },
});
