function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

async function runWithRetry(fn, { retries, backoffMs }, throttler) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await throttler.waitTurn();
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(backoffMs * (attempt + 1));
      }
    }
  }

  throw lastError;
}

function normalizePlayer(row) {
  return {
    id: toNumber(row.id),
    name: row.name || "",
    position: row.position || "",
    number: row.number ?? null,
    nationality: row.nationality || "Unknown",
    age: toNumber(row.age, null),
    image: row.image || null,
    club: row.club || null,
    marketValue: row.marketValue ?? null,
    stats: {
      appearances: toNumber(row.appearances),
      goals: toNumber(row.goals),
      assists: toNumber(row.assists),
      xG: Number(toNumber(row.xG).toFixed(2)),
      xA: Number(toNumber(row.xA).toFixed(2)),
      shots: toNumber(row.shots),
      shotsOnTarget: toNumber(row.shotsOnTarget),
      keyPasses: toNumber(row.keyPasses),
      progressivePasses: toNumber(row.progressivePasses),
      progressiveCarries: toNumber(row.progressiveCarries),
      dribbles: toNumber(row.dribbles),
      dribbleSuccess: toNumber(row.dribbleSuccess),
      aerialWon: toNumber(row.aerialWon),
      aerialLost: toNumber(row.aerialLost),
      tackles: toNumber(row.tackles),
      interceptions: toNumber(row.interceptions),
      minutesPlayed: toNumber(row.minutesPlayed),
      touches: toNumber(row.touches),
      passAccuracy: Number(toNumber(row.passAccuracy).toFixed(1)),
      pressures: toNumber(row.pressures),
      pressureSuccess: Number(toNumber(row.pressureSuccess).toFixed(1))
    },
    radar: {
      shooting: toNumber(row.radar?.shooting),
      passing: toNumber(row.radar?.passing),
      dribbling: toNumber(row.radar?.dribbling),
      defending: toNumber(row.radar?.defending),
      physical: toNumber(row.radar?.physical),
      vision: toNumber(row.radar?.vision)
    },
    form: Array.isArray(row.form) ? row.form.map((v) => toNumber(v)) : []
  };
}

function normalizeMatch(row, arsenalName) {
  const homeTeam = row.homeTeam || "";
  const awayTeam = row.awayTeam || "";
  const homeScore = toNumber(row.homeScore);
  const awayScore = toNumber(row.awayScore);
  const arsenalIsHome = homeTeam === arsenalName;
  const gf = arsenalIsHome ? homeScore : awayScore;
  const ga = arsenalIsHome ? awayScore : homeScore;
  const result = gf > ga ? "W" : gf < ga ? "L" : "D";

  return {
    id: toNumber(row.id),
    date: String(row.date || "").slice(0, 10),
    competition: row.competition || "Premier League",
    matchweek: toNumber(row.matchweek),
    venue: row.venue || "",
    attendance: row.attendance != null ? toNumber(row.attendance) : undefined,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    result,
    stats: row.stats || undefined,
    scorers: Array.isArray(row.scorers) ? row.scorers : undefined,
    assists: Array.isArray(row.assists) ? row.assists : undefined,
    xgTimeline: Array.isArray(row.xgTimeline) ? row.xgTimeline : undefined,
    keyMoments: Array.isArray(row.keyMoments) ? row.keyMoments : undefined
  };
}

function normalizeShot(row) {
  return {
    id: toNumber(row.id),
    matchId: row.matchId != null ? toNumber(row.matchId) : undefined,
    playerId: row.playerId != null ? toNumber(row.playerId) : undefined,
    player: row.player || "",
    team: row.team || undefined,
    minute: row.minute != null ? toNumber(row.minute) : undefined,
    x: toNumber(row.x),
    y: toNumber(row.y),
    xG: Number(toNumber(row.xG).toFixed(3)),
    outcome: row.outcome || "Miss",
    bodyPart: row.bodyPart || undefined,
    type: row.type || undefined,
    season: row.season || undefined
  };
}

async function fetchFbrefData(options = {}) {
  const scraper = options.scraper;
  if (!scraper) {
    throw new Error(
      "FBref scraper module is required. Pass as fetchFbrefData({ scraper })."
    );
  }

  const config = {
    arsenalName: options.arsenalName || "Arsenal",
    minIntervalMs: options.minIntervalMs ?? 1200,
    retries: options.retries ?? 3,
    backoffMs: options.backoffMs ?? 800
  };

  const throttler = new Throttler(config.minIntervalMs);
  const retryConfig = { retries: config.retries, backoffMs: config.backoffMs };

  const [rawPlayers, rawMatches, rawShots] = await Promise.all([
    runWithRetry(() => scraper.getPlayers(), retryConfig, throttler),
    runWithRetry(() => scraper.getMatches(), retryConfig, throttler),
    runWithRetry(() => scraper.getShots(), retryConfig, throttler)
  ]);

  return {
    players: (rawPlayers || []).map(normalizePlayer),
    matches: (rawMatches || []).map((m) => normalizeMatch(m, config.arsenalName)),
    shots: (rawShots || []).map(normalizeShot)
  };
}

module.exports = {
  fetchFbrefData
};

