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
  const res = await fetch(url, {
    headers: {
      "User-Agent": "arsenal-analytics-pipeline/1.0 (+github-actions)"
    }
  });
  if (!res.ok) {
    throw new Error(`FBref fetch failed: ${res.status} ${res.statusText}`);
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

