const path = require("node:path");

const { fetchFplData } = require("../providers/fpl");
const { fetchFootballData } = require("../providers/footballData");
const { fetchFbrefData } = require("../providers/fbref");
const fbrefScraper = require("../providers/fbrefScraper");
const { fetchApiFootballData } = require("../providers/apiFootball");
const { fetchUnderstatData } = require("../providers/understat");
const { TRANSFER_TARGETS } = require("./transferTargets");
const { mergeProviderData } = require("../core/merge");
const { writeCanonicalData, computeQualityReport } = require("../core/dataWriter");

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

function isProviderHealthy(statuses, providerName) {
  const status = (statuses || []).find((s) => s?.provider === providerName);
  return status?.ok === true;
}

function assertQualityThresholds(report, statuses) {
  const footballDataHealthy = isProviderHealthy(statuses, "footballData");
  const apiFootballHealthy = isProviderHealthy(statuses, "apiFootball");
  const fbrefHealthy = isProviderHealthy(statuses, "fbref");
  const requireMatchStats = process.env.REQUIRE_MATCH_STATS === "1";
  const requireXgTimeline = process.env.REQUIRE_XG_TIMELINE === "1";

  const hasStatProvider = footballDataHealthy || apiFootballHealthy || fbrefHealthy;
  const thresholds = {
    maxMissingStatsRatio: requireMatchStats && hasStatProvider ? 0.98 : 1,
    maxMissingTimelineRatio: requireXgTimeline && (fbrefHealthy || isProviderHealthy(statuses, "understat")) ? 0.95 : 1
  };
  const statsRatio = report.matches.total > 0 ? report.matches.missingStats / report.matches.total : 0;
  const timelineRatio = report.matches.total > 0 ? report.matches.missingTimeline / report.matches.total : 0;

  const failures = [];
  if (statsRatio > thresholds.maxMissingStatsRatio) {
    failures.push(`missingStats ratio ${statsRatio.toFixed(2)} exceeds ${thresholds.maxMissingStatsRatio}`);
  }
  if (timelineRatio > thresholds.maxMissingTimelineRatio) {
    failures.push(`missingTimeline ratio ${timelineRatio.toFixed(2)} exceeds ${thresholds.maxMissingTimelineRatio}`);
  }
  return failures;
}

async function runPipeline() {
  console.log("[pipeline] starting refresh...");

  const [fplResult, footballDataResult, fbrefResult, apiFootballResult, understatResult] = await Promise.all([
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
    ),
    runProvider("apiFootball", () =>
      fetchApiFootballData({
        apiKey: process.env.RAPIDAPI_KEY
      })
    ),
    runProvider("understat", () => fetchUnderstatData())
  ]);

  const statuses = [
    fplResult.status,
    footballDataResult.status,
    fbrefResult.status,
    apiFootballResult.status,
    understatResult.status
  ];

  const fpl = fplResult.payload || emptyPayload();
  const footballData = footballDataResult.payload || emptyPayload();
  const fbref = fbrefResult.payload || emptyPayload();
  const apiFootball = apiFootballResult.payload || emptyPayload();
  const understat = understatResult.payload || emptyPayload();

  const merged = mergeProviderData({
    fpl,
    footballData,
    fbref,
    apiFootball,
    understat
  });

  const qualityReport = computeQualityReport({
    players: merged.players,
    matches: merged.matches,
    shots: merged.shots,
    sourceMeta: { statuses }
  });
  const qualityFailures = assertQualityThresholds(qualityReport, statuses);
  console.log(`[pipeline] quality ${JSON.stringify(qualityReport)}`);
  if (qualityReport.providers.failed.length > 0) {
    console.warn(`[pipeline] providers failed: ${qualityReport.providers.failed.join(", ")}`);
  }
  if (qualityFailures.length > 0) {
    console.warn(`[pipeline] quality warnings: ${qualityFailures.join("; ")}`);
    if (process.env.CI === "true" || process.env.STRICT_DATA_QUALITY === "1") {
      throw new Error(`[pipeline] quality gate failed: ${qualityFailures.join("; ")}`);
    }
  }

  const writeResult = await writeCanonicalData({
    players: merged.players,
    matches: merged.matches,
    shots: merged.shots,
    seasonStats: merged.seasonStats,
    transferTargets: TRANSFER_TARGETS,
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
