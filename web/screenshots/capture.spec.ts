import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

/**
 * Seeds a realistic completed experiment through the API, then screenshots
 * the key screens into ../docs/screenshots/. Not a pass/fail test — it's a
 * documentation generator. Run via: npm run screenshots
 */
const API = "http://127.0.0.1:8078";
const OUT = "../docs/screenshots";

const B_START = "2026-04-01";
const B_END = "2026-04-07";
const I_START = "2026-04-08";
const I_END = "2026-04-21";

async function seed(request: APIRequestContext): Promise<string> {
  const exp = await (
    await request.post(`${API}/api/experiments`, {
      data: {
        title: "Higher-protein breakfast vs afternoon hunger",
        question: "Does a higher-protein breakfast reduce my afternoon hunger?",
        hypothesis:
          "Eating 40g of protein at breakfast keeps me fuller, so afternoon hunger drops versus my usual breakfast.",
        baseline_start: B_START,
        baseline_end: B_END,
        intervention_start: I_START,
        intervention_end: I_END,
        primary_outcome: "Afternoon hunger (1-5, lower is better)",
      },
    })
  ).json();
  const id = exp.id as string;

  await request.post(`${API}/api/experiments/${id}/interventions`, {
    data: {
      name: "40g protein breakfast",
      rule_text: "Eat at least 40g of protein within an hour of waking.",
      category: "protein",
      expected_effect: "Lower afternoon hunger and steadier energy.",
    },
  });
  await request.post(`${API}/api/experiments/${id}/outcomes`, {
    data: {
      name: "Afternoon hunger",
      metric: "hunger",
      direction: "lower_better",
      kind: "rating",
      is_primary: true,
    },
  });
  await request.post(`${API}/api/experiments/${id}/outcomes`, {
    data: {
      name: "Afternoon energy",
      metric: "energy",
      direction: "higher_better",
      kind: "rating",
    },
  });
  await request.post(`${API}/api/experiments/${id}/start`);

  // 21 days: baseline (higher hunger, lower energy) then intervention.
  const start = new Date(B_START);
  for (let i = 0; i < 21; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const inter = iso >= I_START;
    const wobble = i % 3 === 0 ? 1 : 0;
    const log = await (
      await request.post(`${API}/api/daily-log`, {
        data: {
          experiment_id: id,
          date: iso,
          hunger: inter ? 2 + wobble : 4 + (i % 4 === 0 ? 1 : 0),
          energy: inter ? 4 - wobble : 3 - (i % 4 === 0 ? 1 : 0),
          digestion: 4,
          sleep_quality: inter ? 4 : 3,
          adherence: inter ? "yes" : null,
        },
      })
    ).json();
    await request.post(`${API}/api/daily-log/${log.id}/meals`, {
      data: {
        description: inter
          ? "Greek yogurt, whey scoop, berries, oats"
          : "Toast with jam and coffee",
        tags: inter ? ["breakfast", "high-protein"] : ["breakfast"],
      },
    });
  }

  await request.post(`${API}/api/experiments/${id}/confounders`, {
    data: {
      date: "2026-04-12",
      kind: "poor_sleep",
      severity: "medium",
      notes: "Bad night's sleep, felt hungrier than usual.",
    },
  });
  await request.post(`${API}/api/experiments/${id}/complete`);
  await request.post(`${API}/api/experiments/${id}/analyze`);
  return id;
}

async function signUp(page: Page): Promise<string> {
  const email = `shots_${Date.now()}@example.com`;
  await page.goto("/login");
  // Capture the editorial sign-in before authenticating.
  await page.screenshot({ path: `${OUT}/login.png`, fullPage: true });
  await page.getByRole("button", { name: "Create one" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return email;
}

test("capture screenshots", async ({ page, request }) => {
  // Clean shots: make the sticky nav static (so it doesn't float mid-page in
  // fullPage captures) and hide the Next.js dev-tools button.
  await page.addInitScript(() => {
    const s = document.createElement("style");
    s.textContent =
      "nav{position:static !important} nextjs-portal,[aria-label='Open Next.js Dev Tools']{display:none !important}";
    document.documentElement.appendChild(s);
  });

  // Fresh user → empty dashboard → onboarding zero-state.
  const email = await signUp(page);
  await expect(page.getByText("Welcome to your lab notebook")).toBeVisible();
  await page.screenshot({ path: `${OUT}/onboarding.png`, fullPage: true });

  // Authenticate the API request context as the same user, then seed.
  await request.post(`${API}/api/auth/login`, {
    data: { email, password: "password123" },
  });
  const id = await seed(request);

  // Dashboard
  await page.goto("/");
  await expect(
    page.getByText("Higher-protein breakfast vs afternoon hunger", {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });

  // Builder (populated, clean)
  await page.goto("/experiments/new");
  await page.getByPlaceholder(/vs afternoon hunger/i).fill("Cut caffeine after noon vs sleep quality");
  await page
    .getByPlaceholder(/reduce my afternoon hunger/i)
    .fill("Does cutting caffeine after noon improve my sleep quality?");
  await page.locator('input[type="date"]').nth(0).fill("2026-05-01");
  await page.locator('input[type="date"]').nth(1).fill("2026-05-07");
  await page.locator('input[type="date"]').nth(2).fill("2026-05-08");
  await page.locator('input[type="date"]').nth(3).fill("2026-05-21");
  await page.getByPlaceholder(/40g protein breakfast/i).fill("No caffeine after noon");
  await page.getByPlaceholder(/Eat at least 40g/i).fill("No caffeine after 12pm.");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/builder.png`, fullPage: true });

  // Detail (analysis visible)
  await page.goto(`/experiments/${id}`);
  await expect(page.getByText(/confidence/i).first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/detail.png`, fullPage: true });

  // Report
  await page.goto(`/reports/${id}`);
  await expect(page.getByText("Recommendation")).toBeVisible();
  await page.screenshot({ path: `${OUT}/report.png`, fullPage: true });
});
