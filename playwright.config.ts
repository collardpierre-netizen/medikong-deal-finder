import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for MediKong responsive smoke tests.
 *
 * Couvre 6 largeurs représentatives pour détecter les régressions de débordement
 * horizontal sur mobile, tablette et desktop :
 *   - mobile-360  : petit Android
 *   - mobile-390  : iPhone 12-14 / Pixel 5
 *   - tablet-768  : iPad portrait
 *   - tablet-1024 : iPad paysage / petit laptop
 *   - desktop-1280
 *   - desktop-1536 : grand écran
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080",
    trace: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 25_000,
  },
  projects: [
    {
      name: "mobile-360",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, isMobile: false },
    },
    {
      name: "mobile-390",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "tablet-768",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "tablet-1024",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } },
    },
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "desktop-1536",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1536, height: 864 } },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:8080",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
