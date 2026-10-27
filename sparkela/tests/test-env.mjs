// Single source for the test clock and the test server environment (plan §19.3, decision 121).
// Plain JS so that Playwright, scripts/with-test-env.mjs (build:test, start:test) and Vitest can all import it.
// Every secret here is obviously fake and at least 32 characters long (lib/env.ts readSecret()).

/** Port of `npm run start:test` and the Playwright base URL. */
export const TEST_PORT = 3200;

/** The server clock of the test build: Friday of the launch, shop open, Holiday Sparkle live, launch gift active. */
export const TEST_NOW_ISO = "2026-11-27T12:00:00+01:00";

/** Same instant as TEST_ENV.SPARKELA_TEST_NOW, in epoch milliseconds. */
export const TEST_NOW = Date.parse(TEST_NOW_ISO);

/** Environment for `npm run build:test`, `npm run start:test` and Playwright's webServer (all values are strings). */
export const TEST_ENV = Object.freeze({
  COMMERCE_PROVIDER: "local",
  SPARKELA_TEST_CLOCK: "1",
  SPARKELA_TEST_NOW: TEST_NOW_ISO,
  PRELAUNCH_BYPASS_TOKEN: "test-preview-token-0123456789abcdefghij",
  EARLY_ACCESS_SECRET: "test-early-access-secret-0123456789abcdef",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${TEST_PORT}`,
});
