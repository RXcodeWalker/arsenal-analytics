// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Page mapping (site has no dedicated /fixtures URL):
 * - Fixtures feed: home index — recent results in #match-log
 * - Squad: player dashboard
 * - Match center: match analysis (selector + header + stats from data)
 */

test.describe("page smoke — data-driven UI", () => {
  test("fixtures feed (home): match log and hero card populate from data", async ({
    page
  }) => {
    await page.goto("/index.html", { waitUntil: "domcontentloaded" });

    const matchLog = page.locator("#match-log");
    await expect(matchLog).toBeVisible();
    await expect(matchLog.locator(".loader")).toHaveCount(0, { timeout: 15_000 });

    const links = matchLog.locator('a[href*="match-analysis"]');
    await expect(links.first()).toBeVisible();
    const firstText = await links.first().innerText();
    expect(firstText.length).toBeGreaterThan(10);
    expect(firstText).toMatch(/Arsenal|Premier|–|-/i);

    const heroBody = page.locator("#hero-match-body");
    await expect(heroBody).toBeVisible();
    await expect(heroBody.locator(".loader")).toHaveCount(0, { timeout: 15_000 });
    await expect(heroBody).toContainText(/Arsenal|Victory|Draw|Defeat|xG/i);

    const playerGrid = page.locator("#player-cards-grid");
    await expect(playerGrid.locator(".loader")).toHaveCount(0, { timeout: 15_000 });
    await expect(playerGrid.locator("a.player-card").first()).toBeVisible();
    await expect(playerGrid).not.toContainText(/#null|Age null|Unknown/i);
  });

  test("squad page: selectors, profile header, and stat strip from players.json", async ({
    page
  }) => {
    await page.goto("/player-dashboard.html", { waitUntil: "domcontentloaded" });

    const selector = page.locator("#player-selector");
    await expect(selector).toBeVisible();
    await expect(selector.locator("button.player-card").first()).toBeVisible({
      timeout: 15_000
    });
    const btnCount = await selector.locator("button.player-card").count();
    expect(btnCount).toBeGreaterThanOrEqual(1);

    const header = page.locator("#player-profile-header");
    await expect(header.locator(".loader")).toHaveCount(0, { timeout: 15_000 });
    const nameHeading = header.locator("h2");
    await expect(nameHeading).toBeVisible();
    expect((await nameHeading.innerText()).trim().length).toBeGreaterThan(3);
    await expect(header).toContainText(/Apps|mins|Age/i);

    const strip = page.locator("#player-stats-strip");
    await expect(strip.locator(".stat-card").first()).toBeVisible();
    await expect(strip).toContainText(/Goals|Shots|Key Passes|xA/i);

    const table = page.locator("#player-stats-table");
    await expect(table).toContainText(/Attacking|Goals|xG/i);
    await expect(page.locator("#player-profile-header")).not.toContainText(/#null|Age null|Unknown/i);
    await expect(selector).not.toContainText(/#null/i);
  });

  test("match center: fixture buttons, header, and key stats from matches.json", async ({
    page
  }) => {
    await page.goto("/match-analysis.html", { waitUntil: "domcontentloaded" });

    const matchSelector = page.locator("#match-selector");
    await expect(matchSelector).toBeVisible();
    await expect(matchSelector.locator("button[id^='match-btn-']").first()).toBeVisible({
      timeout: 15_000
    });
    const btnCount = await matchSelector.locator("button[id^='match-btn-']").count();
    expect(btnCount).toBeGreaterThanOrEqual(1);

    const headerCard = page.locator("#match-header-card");
    await expect(headerCard.locator(".loader")).toHaveCount(0, { timeout: 15_000 });
    await expect(headerCard.locator(".match-header")).toBeVisible();
    await expect(headerCard).toContainText(/Arsenal/);
    await expect(headerCard.locator(".score-number").first()).toBeVisible();

    const keyStats = page.locator("#key-stats-strip");
    const keyStatsCards = await keyStats.locator(".stat-card").count();
    if (keyStatsCards > 0) {
      await expect(keyStats).toContainText(/xG|Pass Accuracy|PPDA/i);
    } else {
      await expect(keyStats).toBeEmpty();
    }

    const statsComp = page.locator("#stats-comparison");
    await expect(statsComp.locator(".loader")).toHaveCount(0, { timeout: 15_000 });
    const statsText = await statsComp.innerText();
    if (/Limited Data/i.test(statsText)) {
      await expect(statsComp).toContainText(/fixture yet/i);
    } else {
      await expect(statsComp).toContainText(/Shots|Possession|Corners/i);
    }
  });

  test("season stats legacy route resolves to canonical page", async ({ page }) => {
    const response = await page.goto("/season-stats.html", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/season-statistics\.html$/);
    await expect(page.locator(".page-header h1")).toContainText(/Season/i);
  });

  test("contact page: header, mailto link, and form", async ({ page }) => {
    await page.goto("/contact.html", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".page-header")).toBeVisible();
    await expect(page.locator(".page-header h1")).toContainText(/Touch/i);
    await expect(
      page.locator('a.btn.btn-primary[href^="mailto:hello@beyondthebasics.me"]')
    ).toBeVisible();
    await expect(page.locator("#contact-form")).toBeVisible();
  });
});
