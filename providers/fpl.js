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
    image: element.code ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${element.code}.png` : null,
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

function getArsenalPerspectiveScores(fixture, arsenalTeamName, teamById) {
  const homeTeam = teamById[fixture.team_h] || `Team-${fixture.team_h}`;
  const awayTeam = teamById[fixture.team_a] || `Team-${fixture.team_a}`;
  const isHome = homeTeam === arsenalTeamName;
  const homeScore = toNumber(fixture.team_h_score, 0);
  const awayScore = toNumber(fixture.team_a_score, 0);
  return {
    isHome,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    gf: isHome ? homeScore : awayScore,
    ga: isHome ? awayScore : homeScore
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
    result,
    resultFromArsenalView: result,
    kickoffUtc: fixture.kickoff_time || undefined
  };
}

function buildTableFromFixtures(fixtures, teamById) {
  const table = new Map();
  const ensure = (teamName) => {
    if (!table.has(teamName)) {
      table.set(teamName, {
        team: teamName,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0
      });
    }
    return table.get(teamName);
  };

  for (const fixture of fixtures) {
    const homeTeam = teamById[fixture.team_h] || `Team-${fixture.team_h}`;
    const awayTeam = teamById[fixture.team_a] || `Team-${fixture.team_a}`;
    const homeScore = toNumber(fixture.team_h_score, 0);
    const awayScore = toNumber(fixture.team_a_score, 0);

    const home = ensure(homeTeam);
    const away = ensure(awayTeam);

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (homeScore < awayScore) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return [...table.values()].sort((a, b) => {
    const pointsDiff = b.points - a.points;
    if (pointsDiff !== 0) return pointsDiff;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    const gdDiff = gdB - gdA;
    if (gdDiff !== 0) return gdDiff;
    const gfDiff = b.goalsFor - a.goalsFor;
    if (gfDiff !== 0) return gfDiff;
    return a.team.localeCompare(b.team);
  });
}

function sumTeamXG(players, teamName) {
  return Number(
    players
      .filter((player) => player.club === teamName)
      .reduce((sum, player) => sum + toNumber(player.stats?.xG, 0), 0)
      .toFixed(2)
  );
}

function buildSeasonStatsFromFpl({ fixtures, players, teamById, arsenalName }) {
  const finished = (fixtures || []).filter(
    (fixture) =>
      fixture &&
      fixture.finished === true &&
      Number.isFinite(Number(fixture.team_h_score)) &&
      Number.isFinite(Number(fixture.team_a_score))
  );
  const arsenalFixtures = finished.filter(
    (fixture) => teamById[fixture.team_h] === arsenalName || teamById[fixture.team_a] === arsenalName
  );
  const table = buildTableFromFixtures(finished, teamById);
  const arsenalRow = table.find((row) => row.team === arsenalName);

  const form = arsenalFixtures
    .slice()
    .sort((a, b) => String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")))
    .map((fixture) => {
      const { gf, ga } = getArsenalPerspectiveScores(fixture, arsenalName, teamById);
      if (gf > ga) return "W";
      if (gf < ga) return "L";
      return "D";
    });

  const cleanSheets = arsenalFixtures.reduce((count, fixture) => {
    const { ga } = getArsenalPerspectiveScores(fixture, arsenalName, teamById);
    return ga === 0 ? count + 1 : count;
  }, 0);

  return {
    played: toNumber(arsenalRow?.played, arsenalFixtures.length),
    won: toNumber(arsenalRow?.won),
    drawn: toNumber(arsenalRow?.drawn),
    lost: toNumber(arsenalRow?.lost),
    goalsFor: toNumber(arsenalRow?.goalsFor),
    goalsAgainst: toNumber(arsenalRow?.goalsAgainst),
    points: toNumber(arsenalRow?.points),
    position: arsenalRow ? table.indexOf(arsenalRow) + 1 : 0,
    cleanSheets,
    xGFor: sumTeamXG(players, arsenalName),
    xGAgainst: 0,
    avgPossession: 0,
    ppda: 0,
    fieldTilt: 0,
    form,
    monthlyXG: []
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
  const players = (bootstrap.elements || [])
    .filter((element) => teamById[element.team] === config.arsenalName)
    .map((element) => normalizePlayer(element, teamById));
  const matches = (fixtures || [])
    .filter((f) => f && f.finished === true)
    .filter((f) => teamById[f.team_h] === config.arsenalName || teamById[f.team_a] === config.arsenalName)
    .map((fixture) => normalizeMatch(fixture, teamById, config.arsenalName));
  const seasonStats = buildSeasonStatsFromFpl({
    fixtures,
    players,
    teamById,
    arsenalName: config.arsenalName
  });

  return { players, matches, seasonStats, shots: [] };
}

module.exports = {
  fetchFplData
};
