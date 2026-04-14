const path = require("node:path");

const { fetchFplData } = require("../providers/fpl");
const { fetchFootballData } = require("../providers/footballData");
const { fetchFbrefData } = require("../providers/fbref");
const fbrefScraper = require("../providers/fbrefScraper");
const { mergeProviderData } = require("../core/merge");
const { writeCanonicalData } = require("../core/dataWriter");

async function runProvider(name, runner) {
  try {
    const payload = await runner();
    console.log(`[pipeline] ${name}: success`);
    return payload;
  } catch (err) {
    console.error(`[pipeline] ${name}: failed -> ${err.message}`);
    return null;
  }
}

function emptyPayload() {
  return { players: [], matches: [], shots: [] };
}

async function runPipeline() {
  console.log("[pipeline] starting refresh...");

  const [fpl, footballData, fbref] = await Promise.all([
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

  const merged = mergeProviderData({
    fpl: fpl || emptyPayload(),
    footballData: footballData || emptyPayload(),
    fbref: fbref || emptyPayload()
  });

  const writeResult = await writeCanonicalData({
    players: merged.players,
    matches: merged.matches,
    shots: merged.shots,
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

