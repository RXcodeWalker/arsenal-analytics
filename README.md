# Arsenal Analytics

A data-driven static site delivering Arsenal FC match and player analytics, plus an automated Node.js pipeline that regenerates canonical JSON used by the frontend.

## Features
- Match analysis with xG timelines and shot maps ([match-analysis.html](match-analysis.html); data: [data/matches.json](data/matches.json)).
- Player dashboard with radar profiles, season stats and form tracking ([player-dashboard.html](player-dashboard.html); data: [data/players.json](data/players.json)).
- Season statistics overview and aggregated metrics ([season-statistics.html](season-statistics.html)).
- Transfer radar / scout view and curated transfer target list ([transfer-radar.html](transfer-radar.html); [pipeline/transferTargets.js](pipeline/transferTargets.js)).
- Tactical articles rendered from Markdown sources ([content/arsenal/](content/arsenal/) and [scripts/generate-articles-index.js](scripts/generate-articles-index.js)).
- Chart visualisations via Chart.js (radar, line/timeline, shot scatter) ([js/charts.js](js/charts.js)).
- Light/dark theme and responsive navigation ([css/main.css](css/main.css); [js/navigation.js](js/navigation.js)).
- Automated data pipeline that merges multiple providers and validates schema ([pipeline/run.js](pipeline/run.js); [core/merge.js](core/merge.js); [core/dataWriter.js](core/dataWriter.js)).
- Playwright E2E smoke tests and CI workflows ([tests/smoke.spec.js](tests/smoke.spec.js); [.github/workflows/e2e.yml](.github/workflows/e2e.yml)).

## Demo / Example

- Live site: https://arsenal.beyondthebasics.me (deployment method not documented in repository).
- Serve locally (open http://127.0.0.1:4173/index.html):

```bash
python -m http.server 4173
# then open http://127.0.0.1:4173/index.html
```

- Run the data pipeline (writes canonical JSON under `data/`):

```bash
# macOS / Linux
export FOOTBALL_DATA_API_KEY="your_key_here"
node pipeline/run.js

# Windows (PowerShell)
$env:FOOTBALL_DATA_API_KEY = "your_key_here"
node pipeline/run.js
```

- Run E2E smoke tests (Playwright):

```bash
npm run test:e2e
npm run test:e2e:ui   # interactive UI for debugging
```

## Installation

Prerequisites:
- Node.js (tested with Node 20)
- Python 3 (for local static server used by tests)

Installation steps:

```bash
git clone <repo-url>
cd "arsenal website"
npm install
npx playwright install chromium --with-deps
cp .env.example .env   # edit .env with required API keys
```

## Usage

- Serve the site locally (static files):

```bash
python -m http.server 4173
# open http://127.0.0.1:4173/index.html
```

- Run the data pipeline (fetch, merge, validate, write canonical JSON):

```bash
node pipeline/run.js
```

- Generate or update the article index after adding Markdown articles:

```bash
npm run generate:articles-index
```

## Project Structure

- [index.html](index.html) — Home / entry page
- [match-analysis.html](match-analysis.html) — Match view and xG timeline
- [player-dashboard.html](player-dashboard.html) — Player profiles and radars
- [season-statistics.html](season-statistics.html) — Season aggregates
- [transfer-radar.html](transfer-radar.html) — Transfer targets and comparisons
- [css/main.css](css/main.css) — Global stylesheet and theme variables
- [js/charts.js](js/charts.js) — Chart.js wrappers and helpers
- [js/navigation.js](js/navigation.js) — Nav + theme persistence
- [content/arsenal/](content/arsenal/) — Markdown tactical articles (source)
- [data/](data/) — Generated canonical JSON (`matches.json`, `players.json`, `shots.json`)
- [pipeline/run.js](pipeline/run.js) — Orchestrates providers, merge, schema validation
- [providers/](providers/) — Provider integrations (fpl, footballData, apiFootball, fbref, understat)
- [core/merge.js](core/merge.js), [core/dataWriter.js](core/dataWriter.js) — Merge & write logic
- [tests/smoke.spec.js](tests/smoke.spec.js) — Playwright E2E smoke tests
- [.github/workflows/data-refresh.yml](.github/workflows/data-refresh.yml) — Cron job to refresh `data/*.json`

For full schema details see [DATA_CONTRACT_SCHEMA.md](DATA_CONTRACT_SCHEMA.md).

## Technologies Used

- Frontend: plain HTML, CSS (custom properties), and vanilla JavaScript
- Visualisations: Chart.js
- Pipeline: Node.js, Puppeteer (fbref scraping), fetch/HTTP APIs
- Markdown: gray-matter + markdown-it (article pipeline)
- Testing: Playwright
- CI/CD: GitHub Actions (E2E and scheduled data refresh)

## Configuration

Environment variables referenced in the codebase:

- `FOOTBALL_DATA_API_KEY` — used by [providers/footballData.js](providers/footballData.js) (required for full pipeline)
- `RAPIDAPI_KEY` — optional, used by [providers/apiFootball.js](providers/apiFootball.js)
- `BOT_GH_TOKEN` — optional, GitHub token used by data refresh workflow to open PRs automatically
- Quality-gate flags (optional): `REQUIRE_MATCH_STATS`, `REQUIRE_XG_TIMELINE` — enforced inside [pipeline/run.js](pipeline/run.js)

See [docs/github-secrets.md](docs/github-secrets.md) for CI secret setup and [CLAUDE.md](CLAUDE.md) for operational notes.

## Future Improvements

- Add unit tests for `core/merge.js` and provider normalization.
- Introduce TypeScript for pipeline and frontend type safety.
- Implement chart export / sharing and CSV/JSON export endpoints.
- Add provider health dashboard and alerting for pipeline failures.

## Learning Outcomes

- Handling and merging heterogeneous sports data from multiple APIs and scrapers.
- Building a static, data-driven analytics frontend with Chart.js and client-side rendering.
- Implementing a scheduled data pipeline with quality gates and CI automation.
- Writing Playwright E2E tests for smoke-checking critical UI flows.

## Contributing

1. Fork the repo and create a feature branch.
2. Run tests locally: `npm run test:e2e`.
3. Update or add tests for any behavior you change.
4. Open a pull request describing your changes.

If you add tactical articles, follow the frontmatter pattern used in `content/arsenal/` and run `npm run generate:articles-index`.

## Why I Built This

This project brings together multiple public football data sources (FPL, football-data.org, FBRef, Understat, API-Football) into a single static site that visualises match and player analytics. The pipeline centralises data collection and schema validation so the frontend can remain simple and static while still serving rich, up-to-date analytics.

## Challenges Solved

- Data reconciliation across providers: `core/merge.js` implements fuzzy name-matching and deduplication to merge inconsistent provider payloads.
- Scraping reliability: FBRef scraping logic in [providers/fbrefScraper.js](providers/fbrefScraper.js) uses Puppeteer and rate-limiting to reduce breakages.
- CI automation: [.github/workflows/data-refresh.yml](.github/workflows/data-refresh.yml) runs the pipeline on a schedule and can open PRs for safe data updates.

## License

This repository is released under the MIT License. See [LICENSE](LICENSE) for details.

---

*Notes:* If any of the environment variables or deployment details are missing for your environment, see the `docs/` folder and [CLAUDE.md](CLAUDE.md) for the operational instructions used by the original project.
# arsenal-analytics
Arsenal stats + analytics website

## Data update ownership
- Automated updates for `data/*.json` are created by GitHub Actions on the `bot-updates` branch via pull requests.
- Keep `main` for human-reviewed changes only.
- Avoid manual edits to generated files in `data/*.json`; use the data pipeline instead.
