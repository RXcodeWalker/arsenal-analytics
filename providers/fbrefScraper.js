/**
 * Minimal FBref scraping entrypoint.
 *
 * This module is intentionally conservative:
 * - It performs a lightweight availability fetch against FBref.
 * - It returns empty collections by default unless you extend parser logic.
 *
 * The pipeline still "fetches" FBref and can be expanded without changing
 * provider/fbref.js or the workflow.
 */

async function safeFetch(url) {
  const cookie = process.env.FBREF_COOKIE || "";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://fbref.com/",
      Cookie: cookie
    }
  });
  if (!res.ok) {
    const details = cookie
      ? "FBREF_COOKIE was provided but challenge still blocked the request."
      : "Set FBREF_COOKIE in your environment to an active browser session cookie to bypass Cloudflare challenge.";
    throw new Error(`FBref fetch failed: ${res.status} ${res.statusText}. ${details}`);
  }
  return await res.text();
}

async function getPlayers() {
  // Arsenal squad page can be parsed in future iterations.
  await safeFetch("https://fbref.com/en/squads/18bb7c10/Arsenal-Stats");
  return [];
}

async function getMatches() {
  // Arsenal match logs endpoint can be parsed in future iterations.
  await safeFetch("https://fbref.com/en/squads/18bb7c10/matchlogs/all_comps/schedule/Arsenal-Scores-and-Fixtures-All-Competitions");
  return [];
}

async function getShots() {
  // Placeholder for shot-level parsing.
  await safeFetch("https://fbref.com/en/squads/18bb7c10/Arsenal-Stats");
  return [];
}

module.exports = {
  getPlayers,
  getMatches,
  getShots
};

