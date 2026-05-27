import { defineConfig, devices } from "@playwright/test";

/**
 * Screenshot capture config — NOT part of the test suite (the main config's
 * testDir is ./e2e). Boots the same isolated stack and writes PNGs into
 * docs/screenshots/. Run with: npm run screenshots
 */
const TEST_DB =
  process.env.NUTRITION_LAB_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/nutrition_lab_test";

const API = "http://127.0.0.1:8078";
const WEB = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./screenshots",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: WEB,
    viewport: { width: 1180, height: 900 },
    deviceScaleFactor: 2,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "python -m nutrition_lab.serve",
      cwd: "..",
      url: `${API}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NUTRITION_LAB_PORT: "8078",
        NUTRITION_LAB_DATABASE_URL: TEST_DB,
        NUTRITION_LAB_CORS_ORIGINS: `${WEB},http://localhost:3100`,
      },
    },
    {
      command: "npm run dev -- -p 3100",
      url: WEB,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: API },
    },
  ],
});
