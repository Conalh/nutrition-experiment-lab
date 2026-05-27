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
  await expect(page.getByText("Finding").first()).toBeVisible();
});

/**
 * Drives the core loop in a real browser:
 * dashboard → builder → daily log → detail (analyze) → report.
 */
test("create, log, analyze, and report an experiment", async ({ page }) => {
  const title = `E2E protein breakfast ${Date.now()}`;

  // 1. Sign up → onboarding → builder
  await signUp(page);
  await page.getByRole("link", { name: /create your first experiment/i }).click();
  await page.waitForURL(/\/experiments\/new/);

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

  // 3. Start logging → lands on detail
  await page.getByRole("button", { name: "Start logging" }).click();
  await page.waitForURL(/\/experiments\/exp_/);
  const expId = page.url().split("/experiments/")[1].replace(/\/$/, "");

  // 4. Daily log: select our experiment, rate hunger, set adherence, save
  await page.goto("/log");
  await page.locator("select").first().selectOption({ label: title });
  await page
    .getByRole("radiogroup", { name: /Hunger rating/i })
    .getByRole("radio")
    .nth(3)
    .click(); // hunger = 4
  await page.getByRole("radio", { name: "Yes" }).click(); // adherence
  await page.getByRole("button", { name: "Save day" }).first().click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // 5. Detail: run analysis
  await page.goto(`/experiments/${expId}`);
  await page.getByRole("button", { name: "Run analysis" }).first().click();
  await expect(page.getByText("Finding").first()).toBeVisible();
  await expect(page.getByText("Recommendation")).toBeVisible();

  // 6. Report renders with a PDF download
  await page.getByRole("link", { name: /report/i }).first().click();
  await page.waitForURL(/\/reports\/exp_/);
  await expect(page.getByText("Download PDF")).toBeVisible();
  await expect(page.getByText("Recommendation")).toBeVisible();

  // 7. Delete the experiment from the detail page → back to an empty dashboard
  await page.goto(`/experiments/${expId}`);
  await page.getByRole("button", { name: "Delete experiment" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByText("Welcome to your lab notebook")).toBeVisible();
});
