const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mapPosition(elementType) {
  const mapping = {
    1: "GK",
    2: "DEF",
    3: "MID",
    4: "FWD"
  };
  return mapping[toNumber(elementType, 0)] || "UNK";
}

function buildResult(homeTeam, awayTeam, homeScore, awayScore, arsenalName) {
  const arsenalIsHome = homeTeam === arsenalName;
  const gf = arsenalIsHome ? homeScore : awayScore;
  const ga = arsenalIsHome ? awayScore : homeScore;
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
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

async function requestWithRetry(url, options, retryConfig, throttler) {
  const { retries, backoffMs } = retryConfig;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await throttler.waitTurn();
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`FPL request failed: ${response.status} ${response.statusText}`);
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

function normalizePlayer(element, teamById) {
  const goals = toNumber(element.goals_scored);
  const assists = toNumber(element.assists);
  const xg = toNumber(element.expected_goals);
  const xa = toNumber(element.expected_assists);
  const shots = toNumber(element.shots);
  const shotsOnTarget = 0;
  const minutesPlayed = toNumber(element.minutes);
  const appearances = toNumber(element.starts);
  const creativity = toNumber(element.creativity);
  const influence = toNumber(element.influence);
  const threat = toNumber(element.threat);
  const completedPasses = toNumber(element.passes_completed);
  const attemptedPasses = toNumber(element.passes);
  const passAccuracy =
    attemptedPasses > 0
      ? Number(((completedPasses / attemptedPasses) * 100).toFixed(1))
      : 0;
  const dribbles = toNumber(element.dribbles);
  const successfulDribbles = toNumber(element.dribbles_successful);
  const dribbleSuccess = Math.min(successfulDribbles, dribbles);
  const shirtNumberRaw = toNumber(element.squad_number, 0);
  const shirtNumber = shirtNumberRaw > 0 ? shirtNumberRaw : null;

  return {
    id: toNumber(element.id),
    name: `${element.first_name} ${element.second_name}`.trim(),
    position: mapPosition(element.element_type),
    number: shirtNumber,
    nationality: "N/A",
    age: null,
    image: null,
    club: teamById[element.team] || "Unknown",
    stats: {
      appearances,
      goals,
      assists,
      xG: Number(xg.toFixed(2)),
      xA: Number(xa.toFixed(2)),
      shots,
      shotsOnTarget,
      keyPasses: Math.round(creativity),
      progressivePasses: 0,
      progressiveCarries: 0,
      dribbles,
      dribbleSuccess,
      aerialWon: 0,
      aerialLost: 0,
      tackles: 0,
      interceptions: 0,
      minutesPlayed,
      touches: 0,
      passAccuracy,
      pressures: 0,
      pressureSuccess: 0
    },
    radar: {
      shooting: clamp(Math.round((goals * 6 + xg * 4)), 0, 100),
      passing: clamp(Math.round(creativity / 1.2), 0, 100),
      dribbling: clamp(Math.round(influence / 1.2), 0, 100),
      defending: 40,
      physical: clamp(Math.round(threat / 1.5), 0, 100),
      vision: clamp(Math.round((creativity + influence) / 3), 0, 100)
    },
    form: []
  };
}

function normalizeMatch(fixture, teamById, arsenalName) {
  const homeTeam = teamById[fixture.team_h] || `Team-${fixture.team_h}`;
  const awayTeam = teamById[fixture.team_a] || `Team-${fixture.team_a}`;
  const homeScore = toNumber(fixture.team_h_score, 0);
  const awayScore = toNumber(fixture.team_a_score, 0);
  const result = buildResult(homeTeam, awayTeam, homeScore, awayScore, arsenalName);

  return {
    id: toNumber(fixture.id),
    date: (fixture.kickoff_time || "").slice(0, 10),
    competition: "Premier League",
    matchweek: toNumber(fixture.event, 0),
    venue: homeTeam,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    result
  };
}

async function fetchFplData(options = {}) {
  const config = {
    arsenalName: options.arsenalName || "Arsenal",
    minIntervalMs: options.minIntervalMs ?? 400,
    retries: options.retries ?? 3,
    backoffMs: options.backoffMs ?? 500
  };

  const throttler = new Throttler(config.minIntervalMs);
  const retryConfig = { retries: config.retries, backoffMs: config.backoffMs };

  const [bootstrap, fixtures] = await Promise.all([
    requestWithRetry(`${FPL_BASE_URL}/bootstrap-static/`, {}, retryConfig, throttler),
    requestWithRetry(`${FPL_BASE_URL}/fixtures/`, {}, retryConfig, throttler)
  ]);

  const teamById = Object.fromEntries((bootstrap.teams || []).map((team) => [team.id, team.name]));
  const players = (bootstrap.elements || []).map((element) => normalizePlayer(element, teamById));
  const matches = (fixtures || [])
    .filter((f) => teamById[f.team_h] === config.arsenalName || teamById[f.team_a] === config.arsenalName)
    .map((fixture) => normalizeMatch(fixture, teamById, config.arsenalName));

  return { players, matches, shots: [] };
}

module.exports = {
  fetchFplData
};

