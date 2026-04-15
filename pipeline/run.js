const path = require("node:path");

const { fetchFplData } = require("../providers/fpl");
const { fetchFootballData } = require("../providers/footballData");
const { fetchFbrefData } = require("../providers/fbref");
const fbrefScraper = require("../providers/fbrefScraper");
const { mergeProviderData } = require("../core/merge");
const { writeCanonicalData } = require("../core/dataWriter");

async function runProvider(name, runner) {
  const fetchedAt = new Date().toISOString();
  try {
    const payload = await runner();
    console.log(`[pipeline] ${name}: success`);
    return {
      payload,
      status: {
        provider: name,
        fetchedAt,
        ok: true
      }
    };
  } catch (err) {
    console.error(`[pipeline] ${name}: failed -> ${err.message}`);
    return {
      payload: null,
      status: {
        provider: name,
        fetchedAt,
        ok: false,
        message: err.message
      }
    };
  }
}

function emptyPayload() {
  return { players: [], matches: [], shots: [], seasonStats: null };
}

function getSeasonLabel(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const startYear = month >= 6 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}/${endYearShort}`;
}

async function runPipeline() {
  console.log("[pipeline] starting refresh...");

  const [fplResult, footballDataResult, fbrefResult] = await Promise.all([
    runProvider("fpl", () => fetchFplData()),
    runProvider("footballData", () =>
      fetchFootballData({
        apiKey: process.env.FOOTBALL_DATA_API_KEY
      })
    ),
    runProvider("fbref", () =>
      fetchFbrefData({
        scraper: fbrefScraper
      })
    )
  ]);

  const statuses = [fplResult.status, footballDataResult.status, fbrefResult.status];
  const fpl = fplResult.payload || emptyPayload();
  const footballData = footballDataResult.payload || emptyPayload();
  const fbref = fbrefResult.payload || emptyPayload();

  const merged = mergeProviderData({
    fpl,
    footballData,
    fbref
  });

  const writeResult = await writeCanonicalData({
    players: merged.players,
    matches: merged.matches,
    shots: merged.shots,
    seasonStats: merged.seasonStats,
    sourceMeta: { statuses },
    generatedAt: new Date().toISOString(),
    season: getSeasonLabel(),
    dataDir: path.resolve(process.cwd(), "data")
  });

  const wroteAnything =
    writeResult.players.written || writeResult.matches.written || writeResult.shots.written;

  console.log(
    `[pipeline] completed. wrote=${wroteAnything} ` +
      `players=${merged.players.length} matches=${merged.matches.length} shots=${merged.shots.length}`
  );
}

runPipeline().catch((err) => {
  console.error(`[pipeline] fatal: ${err.stack || err.message}`);
  process.exit(1);
});

