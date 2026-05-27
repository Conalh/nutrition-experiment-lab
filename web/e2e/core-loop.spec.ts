import { expect, type Page, test } from "@playwright/test";

/** Sign up a fresh user through the UI; lands authenticated on the dashboard.
 * A unique email avoids collisions (the test DB isn't reset between tests). */
async function signUp(page: Page): Promise<void> {
  const email = `e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/login");
  await page.getByRole("button", { name: "Create one" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("shows onboarding and loads a demo from the zero-state", async ({
  page,
}) => {
  await signUp(page); // fresh user → empty dashboard → onboarding

  await expect(page.getByText("Welcome to your lab notebook")).toBeVisible();

  await page.getByRole("button", { name: "Load a demo experiment" }).click();
  await page.waitForURL(/\/experiments\/exp_/);
  await expect(page.getByText("Protocol")).toBeVisible();
});

/**
 * Drives the core loop in a real browser:
 * dashboard → builder → daily log → detail (analyze) → report.
 * Uses a unique title so it never collides with leftover test data.
 */
test("create, log, analyze, and report an experiment", async ({ page }) => {
  const title = `E2E protein breakfast ${Date.now()}`;

  // 1. Sign up → dashboard → builder
  await signUp(page);
  await page.getByRole("link", { name: /new experiment/i }).first().click();
  await expect(
    page.getByRole("heading", { name: /design an experiment/i }),
  ).toBeVisible();

  // 2. Fill the protocol
  await page.getByPlaceholder(/vs afternoon hunger/i).fill(title);
  await page
    .getByPlaceholder(/reduce my afternoon hunger/i)
    .fill("Does a higher-protein breakfast reduce afternoon hunger?");

  const dates = page.locator('input[type="date"]');
  await dates.nth(0).fill("2026-03-01"); // baseline start
  await dates.nth(1).fill("2026-03-07"); // baseline end
  await dates.nth(2).fill("2026-03-08"); // intervention start
  await dates.nth(3).fill("2026-03-21"); // intervention end

  await page.getByPlaceholder(/40g protein breakfast/i).fill("40g protein breakfast");
  await page
    .getByPlaceholder(/Eat at least 40g/i)
    .fill("Eat at least 40g of protein within an hour of waking.");
  // The default primary outcome (hunger / lower_better) is pre-filled.

  // 3. Create & start → lands on detail
  await page.getByRole("button", { name: "Create & start" }).click();
  await page.waitForURL(/\/experiments\/exp_/);
  await expect(page.getByText("Protocol")).toBeVisible();
  const expId = page.url().split("/experiments/")[1].replace(/\/$/, "");

  // 4. Daily log: select our experiment, rate, set adherence, save
  await page.goto("/log");
  await page.locator("select").first().selectOption({ label: title });
  await page.getByRole("button", { name: "Hunger 4" }).click();
  await page.locator("button", { hasText: /^yes$/ }).click();
  await page.getByRole("button", { name: "Save day" }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();

  // 5. Detail: run analysis
  await page.goto(`/experiments/${expId}`);
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(page.getByText(/confidence/i).first()).toBeVisible();
  await expect(page.getByText(/Recommendation:/)).toBeVisible();

  // 6. Report renders with a PDF download
  await page.getByRole("button", { name: "View report" }).click();
  await page.waitForURL(/\/reports\/exp_/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Download PDF")).toBeVisible();
  await expect(page.getByText("Recommendation")).toBeVisible();
});
