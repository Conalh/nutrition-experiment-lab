import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Boots an isolated stack so tests never touch the real app DB:
 *   - FastAPI backend on :8078 against the nutrition_lab_test database
 *   - Next.js dev server on :3100 pointed at that backend
 *
 * Locally, reuseExistingServer lets a re-run attach to already-running
 * servers; in CI both are started fresh. The backend command runs from the
 * repo root (cwd: "..") so `python -m nutrition_lab.serve` resolves.
 */
const TEST_DB =
  process.env.NUTRITION_LAB_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/nutrition_lab_test";

const API = "http://127.0.0.1:8078";
const WEB = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "list" : "line",
  use: {
    baseURL: WEB,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
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
        NUTRITION_LAB_SESSION_SECRET: "e2e-secret",
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
