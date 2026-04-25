const FOOTBALL_DATA_BASE_URL = "https://api.football-data.org/v4";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTeamLabel(name) {
  return String(name || "")
    .replace(/\bFC\b/g, "")
    .replace(/\bAFC\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

class Throttler {
  constructor(minIntervalMs) {
    this.minIntervalMs = minIntervalMs;
    this.lastRunAt = 0;
  }

  async waitTurn() {
    const now = Date.now();
    const elapsed = now - this.lastRunAt;
    const waitFor = this.minIntervalMs - elapsed;
    if (waitFor > 0) await sleep(waitFor);
    this.lastRunAt = Date.now();
  }
}

async function requestWithRetry(path, { apiKey, retries, backoffMs }, throttler) {
  const url = `${FOOTBALL_DATA_BASE_URL}${path}`;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await throttler.waitTurn();
      const response = await fetch(url, {
        headers: {
          "X-Auth-Token": apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`football-data request failed: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(backoffMs * (attempt + 1));
      }
    }
  }

  throw lastError;
}

function computeResultFromArsenalPerspective(match, arsenalTeamId) {
  const isHome = match.homeTeam?.id === arsenalTeamId;
  const homeScore = toNumber(match.score?.fullTime?.home, 0);
  const awayScore = toNumber(match.score?.fullTime?.away, 0);
  const gf = isHome ? homeScore : awayScore;
  const ga = isHome ? awayScore : homeScore;
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
}

function normalizeMatch(match, arsenalTeamId) {
  const homeScore = toNumber(match.score?.fullTime?.home, 0);
  const awayScore = toNumber(match.score?.fullTime?.away, 0);

  return {
    id: toNumber(match.id),
    date: String(match.utcDate || "").slice(0, 10),
    competition: match.competition?.name || "Premier League",
    matchweek: toNumber(match.matchday, 0),
    venue: normalizeTeamLabel(match.venue || match.homeTeam?.name || ""),
    homeTeam: normalizeTeamLabel(match.homeTeam?.name || ""),
    awayTeam: normalizeTeamLabel(match.awayTeam?.name || ""),
    homeScore,
    awayScore,
    result: computeResultFromArsenalPerspective(match, arsenalTeamId),
    resultFromArsenalView: computeResultFromArsenalPerspective(match, arsenalTeamId)
  };
}

function normalizeSeasonStats(standingsTable, arsenalName) {
  const row = (standingsTable || []).find((entry) => entry.team?.name === arsenalName);
  if (!row) return null;

  return {
    played: toNumber(row.playedGames),
    won: toNumber(row.won),
    drawn: toNumber(row.draw),
    lost: toNumber(row.lost),
    goalsFor: toNumber(row.goalsFor),
    goalsAgainst: toNumber(row.goalsAgainst),
    points: toNumber(row.points),
    position: toNumber(row.position)
  };
}

async function fetchFootballData(options = {}) {
  const apiKey = options.apiKey || process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY is required.");
  }

  const config = {
    arsenalTeamId: options.arsenalTeamId ?? 57, // Arsenal FC in football-data
    arsenalName: options.arsenalName || "Arsenal FC",
    minIntervalMs: options.minIntervalMs ?? 6200, // free tier: 10 req/min
    retries: options.retries ?? 3,
    backoffMs: options.backoffMs ?? 700
  };

  const throttler = new Throttler(config.minIntervalMs);

  const [matchPayload, standingsPayload] = await Promise.all([
    requestWithRetry(
      `/teams/${config.arsenalTeamId}/matches?status=FINISHED&limit=50`,
      { apiKey, retries: config.retries, backoffMs: config.backoffMs },
      throttler
    ),
    requestWithRetry(
      `/competitions/PL/standings`,
      { apiKey, retries: config.retries, backoffMs: config.backoffMs },
      throttler
    )
  ]);

  const matches = (matchPayload.matches || []).map((match) => normalizeMatch(match, config.arsenalTeamId));
  const seasonStats = normalizeSeasonStats(standingsPayload.standings?.[0]?.table, config.arsenalName);

  return {
    matches,
    seasonStats,
    players: [],
    shots: []
  };
}

module.exports = {
  fetchFootballData
};

