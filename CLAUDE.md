# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run E2E smoke tests (requires Python HTTP server auto-started by Playwright)
npm run test:e2e

# Run E2E tests with interactive UI for debugging
npm run test:e2e:ui

# Execute the data refresh pipeline manually
node pipeline/run.js

# Serve static files locally (base URL used by Playwright: http://127.0.0.1:4173)
python -m http.server 4173
```

**Live site:** https://arsenal.beyondthebasics.me

Set `FOOTBALL_DATA_API_KEY` (see `.env.example`) before running the pipeline locally. `BOT_GH_TOKEN` is optional — without it the pipeline commits directly to `main` instead of opening a PR on `bot-updates`.

## Architecture

**Arsenal Analytics** is a static HTML/CSS/JS site backed by three JSON files in `data/` that are regenerated every 12 hours by a Node.js pipeline running on GitHub Actions.

### Frontend (no build step, no framework)

- Vanilla HTML pages (`index.html`, `player-dashboard.html`, `match-analysis.html`, `season-statistics.html`, `transfer-radar.html`) each fetch JSON at runtime via `fetch(url + '?t=' + Date.now())` to bypass browser cache.
- `css/main.css` — single global stylesheet with light/dark theme support.
- `js/navigation.js` — nav toggle and `localStorage`-persisted theme.
- `js/charts.js` — Chart.js wrappers for xG, shot maps, radar charts.
- `season-stats.html` redirects to `season-statistics.html` (legacy route).

### Data files (`data/`)

Three canonical JSON files act as the contract between the pipeline and the frontend. Their schema is documented in `DATA_CONTRACT_SCHEMA.md`:

| File | Contents |
|------|----------|
| `matches.json` | `MatchRecord[]` — results, possession, xG, key moments, timeline |
| `players.json` | `PlayerRecord[]` — stats, radar profile, form |
| `shots.json` | `ShotEvent[]`, per-player/match summaries, transfer targets |

All files share a common envelope: `schemaVersion`, `generatedAt`, `season`, and `sourceMeta` (per-provider fetch status).

### Data pipeline (`pipeline/`, `providers/`, `core/`)

`pipeline/run.js` orchestrates three providers in parallel, then merges and writes:

```
providers/fpl.js          → FPL API (squad, goals, xG, form)
providers/footballData.js → football-data.org API (match records, stats)
providers/fbref.js +
providers/fbrefScraper.js → Puppeteer scrape of FBRef (shot maps, xG timeline)
        ↓
core/merge.js             → deduplicate & merge across sources (name-match + Jaccard fallback)
        ↓
Quality gates             → fail if provider health checks breach thresholds
        ↓
core/dataWriter.js        → schema validate, normalize, write data/*.json
```

### CI/CD (`.github/workflows/`)

- **`e2e.yml`** — runs Playwright smoke tests on every push/PR.
- **`data-refresh.yml`** — cron `0 */12 * * *`; runs `node pipeline/run.js`, then either opens an auto-merge PR on `bot-updates` (if `BOT_GH_TOKEN` is set) or commits directly to `main`.

### Tests (`tests/`)

Only E2E smoke tests exist (`tests/smoke.spec.js`). Playwright starts a Python HTTP server on port 4173 automatically. There are no unit tests.
