import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for MediKong responsive smoke tests.
 * Runs the Vite dev server and checks key pages render correctly
 * on both desktop and mobile viewports.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080",
    trace: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
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
