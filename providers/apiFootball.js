const { toNumber, toInt, isObject, normalizeTeamLabel, sleep } = require("../core/utils");

const API_SPORTS_HOST = "v3.football.api-sports.io";
const BASE_URL = `https://${API_SPORTS_HOST}`;
const ARSENAL_TEAM_ID = 42;
// Each fixture costs 3 requests (stats + events + players); reserve headroom below 100/day free cap
const REQUEST_LIMIT = 87;
const REQUESTS_PER_FIXTURE = 3;

function parsePossession(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw.replace("%", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapStatType(type) {
  const t = String(type || "").toLowerCase().trim();
  if (t === "shots on goal" || t === "shots on target") return "shotsOnTarget";
  if (t === "total shots" || t === "shots total") return "shots";
  if (t === "ball possession" || t === "possession") return "possession";
  if (t === "corner kicks" || t === "corners") return "corners";
  if (t === "fouls") return "fouls";
  if (t === "yellow cards") return "yellowCards";
  if (t === "red cards") return "redCards";
  if (t === "total passes" || t === "passes total") return "passes";
  if (t === "passes accurate" || t === "passes accuracy") return "passAccuracy";
  if (t === "expected goals" || t === "xg" || t === "expected_goals") return "xG";
  if (t === "goalkeeper saves") return "saves";
  return null;
}

function extractTeamStats(statisticsArray, teamId) {
  const bucket = {};
  if (!Array.isArray(statisticsArray)) return bucket;

  const entry = statisticsArray.find(
    (s, i) => isObject(s) && (toNumber(s.team?.id) === teamId || (!teamId && i === 0))
  );
  if (!entry) return bucket;

  for (const row of Array.isArray(entry.statistics) ? entry.statistics : []) {
    const key = mapStatType(row?.type);
    if (!key) continue;

    const usePercent = key === "possession" || key === "passAccuracy";
    const parsed = usePercent ? parsePossession(row?.value) : toNumber(row?.value, null);
    if (parsed !== null) bucket[key] = parsed;
  }
  return bucket;
}

function mapEventType(event) {
  const type = String(event?.type || "").toLowerCase();
  const detail = String(event?.detail || "").toLowerCase();
  if (type === "goal") return "goal";
  if (type === "card") {
    if (detail.includes("yellow")) return "yellow";
    if (detail.includes("red")) return "red";
  }
  if (type === "subst") return "sub";
  return null;
}

function normalizeEvents(eventsArray) {
  const scorers = [];
  const assists = [];
  const keyMoments = [];

  if (!Array.isArray(eventsArray)) return { scorers, assists, keyMoments };

  for (const ev of eventsArray) {
    const minute = toInt(ev?.time?.elapsed, 0) + toInt(ev?.time?.extra, 0);
    const teamName = normalizeTeamLabel(ev?.team?.name || "");
    const eventType = mapEventType(ev);

    if (!eventType) continue;

    if (eventType === "goal") {
      const scorerName = ev?.player?.name || "";
      const assistName = ev?.assist?.name || "";
      const isOwnGoal = String(ev?.detail || "").toLowerCase().includes("own goal");

      if (scorerName) scorers.push({ player: scorerName, minute, team: teamName });
      if (assistName) assists.push({ player: assistName, minute, team: teamName });
      keyMoments.push({
        minute,
        type: isOwnGoal ? "own_goal" : "goal",
        team: teamName,
        player: scorerName || undefined,
        note: ev?.detail || undefined
      });
    } else if (eventType === "yellow" || eventType === "red") {
      keyMoments.push({
        minute,
        type: "card",
        team: teamName,
        player: ev?.player?.name || undefined,
        note: ev?.detail || undefined
      });
    }
  }

  keyMoments.sort((a, b) => toNumber(a.minute, 0) - toNumber(b.minute, 0));
  return { scorers, assists, keyMoments };
}

function normalizeFixture(fixture, homeStats, awayStats, events) {
  const fixtureData = fixture.fixture || fixture;
  const teams = fixture.teams || {};
  const goals = fixture.goals || {};
  const score = fixture.score || {};

  const homeScore = toInt(goals.home ?? score.fulltime?.home ?? 0);
  const awayScore = toInt(goals.away ?? score.fulltime?.away ?? 0);
  const isArsenalHome = toNumber(teams.home?.id) === ARSENAL_TEAM_ID;

  const arsenalScore = isArsenalHome ? homeScore : awayScore;
  const oppScore = isArsenalHome ? awayScore : homeScore;
  let resultFromArsenalView;
  if (arsenalScore > oppScore) resultFromArsenalView = "W";
  else if (arsenalScore < oppScore) resultFromArsenalView = "L";
  else resultFromArsenalView = "D";

  const rawDate = fixtureData.date || "";
  const homeTeam = normalizeTeamLabel(teams.home?.name || "");
  const awayTeam = normalizeTeamLabel(teams.away?.name || "");

  const statsObj = {};
  if (Object.keys(homeStats).length > 0) statsObj.home = homeStats;
  if (Object.keys(awayStats).length > 0) statsObj.away = awayStats;

  const { scorers, assists, keyMoments } = normalizeEvents(events);

  const round = String(fixture.league?.round || fixture.matchday || "");
  const matchweekMatch = round.match(/(\d+)/);
  const matchweek = matchweekMatch ? toInt(matchweekMatch[1]) : 0;

  return {
    id: toInt(fixtureData.id),
    externalIds: { apiFootball: toInt(fixtureData.id) },
    date: rawDate.slice(0, 10),
    kickoffUtc: rawDate || undefined,
    competition: fixture.league?.name || fixture.competition?.name || "Premier League",
    matchweek,
    venue: fixtureData.venue?.name || homeTeam,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    result: resultFromArsenalView,
    resultFromArsenalView,
    stats: statsObj,
    scorers,
    assists,
    xgTimeline: [],
    keyMoments
  };
}

function normalizePlayerStats(playersResponse) {
  const result = [];
  if (!Array.isArray(playersResponse)) return result;

  const arsenalEntry = playersResponse.find(
    (e) => toNumber(e?.team?.id) === ARSENAL_TEAM_ID
  );
  if (!arsenalEntry || !Array.isArray(arsenalEntry.players)) return result;

  for (const entry of arsenalEntry.players) {
    const p = entry?.player || {};
    const s = (Array.isArray(entry?.statistics) ? entry.statistics[0] : entry?.statistics) || {};
    const goals = s.goals || {};
    const shotsObj = s.shots || {};
    const passesObj = s.passes || {};
    const tacklesObj = s.tackles || {};
    const duelsObj = s.duels || {};
    const dribblesObj = s.dribbles || {};
    const cards = s.cards || {};

    result.push({
      playerId: toInt(p.id),
      name: p.name || "",
      minutesPlayed: toInt(s.games?.minutes),
      goals: toInt(goals.total),
      assists: toInt(goals.assists),
      shots: toInt(shotsObj.total),
      shotsOnTarget: toInt(shotsObj.on),
      keyPasses: toInt(passesObj.key),
      passes: toInt(passesObj.total),
      passAccuracy: toNumber(passesObj.accuracy, null),
      tackles: toInt(tacklesObj.total),
      interceptions: toInt(tacklesObj.interceptions),
      aerialWon: toInt(duelsObj.won),
      aerialTotal: toInt(duelsObj.total),
      dribbles: toInt(dribblesObj.attempts),
      dribbleSuccess: toInt(dribblesObj.success),
      yellowCards: toInt(cards.yellow),
      redCards: toInt(cards.red)
    });
  }

  return result;
}

async function apiRequest(path, apiKey) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status} ${response.statusText} (${path})`);
  }

  const data = await response.json();

  if (data?.errors && Object.keys(data.errors).length > 0) {
    const errStr = JSON.stringify(data.errors);
    if (errStr.includes("rateLimit") || errStr.includes("quota")) {
      throw new Error(`API-Football rate limit hit: ${errStr}`);
    }
    console.warn(`[apiFootball] non-fatal API errors for ${path}: ${errStr}`);
  }

  return data;
}

async function fetchApiFootballData(options = {}) {
  const apiKey = options.apiKey || process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error("RAPIDAPI_KEY is required for API-Football provider.");
  }

  const season = options.season ?? 2025;
  let requestCount = 0;

  console.log("[apiFootball] fetching finished fixtures for Arsenal...");
  const fixturesData = await apiRequest(
    `/fixtures?team=${ARSENAL_TEAM_ID}&season=${season}&status=FT`,
    apiKey
  );
  requestCount += 1;

  const rawFixtures = Array.isArray(fixturesData?.response) ? fixturesData.response : [];
  if (rawFixtures.length === 0) {
    console.warn("[apiFootball] no finished fixtures returned");
    return { players: [], matches: [], shots: [], seasonStats: null, playerMatchStats: {} };
  }

  console.log(`[apiFootball] found ${rawFixtures.length} finished fixtures. Enriching...`);

  // Sort descending by date — prioritise recent matches if we approach the rate cap
  const sorted = rawFixtures.slice().sort((a, b) =>
    String(b.fixture?.date || "").localeCompare(String(a.fixture?.date || ""))
  );

  const matches = [];
  const playerMatchStats = {};

  for (const fixture of sorted) {
    // Each fixture costs REQUESTS_PER_FIXTURE calls; bail early if quota insufficient
    if (requestCount + REQUESTS_PER_FIXTURE > REQUEST_LIMIT) {
      console.warn(`[apiFootball] quota limit (${REQUEST_LIMIT}) reached, stopping enrichment.`);
      break;
    }

    const fixtureId = toInt(fixture.fixture?.id);
    if (!fixtureId) continue;

    let statsResponse = [];
    let eventsResponse = [];
    let playersResponse = [];

    try {
      // Single sleep before the parallel batch respects rate limiting without tripling latency
      await sleep(800);

      const [statsData, eventsData, playersData] = await Promise.all([
        apiRequest(`/fixtures/statistics?fixture=${fixtureId}`, apiKey),
        apiRequest(`/fixtures/events?fixture=${fixtureId}`, apiKey),
        apiRequest(`/fixtures/players?fixture=${fixtureId}&team=${ARSENAL_TEAM_ID}`, apiKey)
      ]);

      requestCount += REQUESTS_PER_FIXTURE;
      statsResponse = Array.isArray(statsData?.response) ? statsData.response : [];
      eventsResponse = Array.isArray(eventsData?.response) ? eventsData.response : [];
      playersResponse = Array.isArray(playersData?.response) ? playersData.response : [];
    } catch (err) {
      console.warn(`[apiFootball] fixture ${fixtureId} enrichment failed: ${err.message}`);
      requestCount += REQUESTS_PER_FIXTURE; // count failed requests to avoid infinite retries
    }

    const homeId = toNumber(fixture.teams?.home?.id);
    const awayId = toNumber(fixture.teams?.away?.id);
    const homeStats = extractTeamStats(statsResponse, homeId);
    const awayStats = extractTeamStats(statsResponse, awayId);
    const playerStats = normalizePlayerStats(playersResponse);

    if (playerStats.length > 0) {
      playerMatchStats[fixtureId] = playerStats;
    }

    matches.push(normalizeFixture(fixture, homeStats, awayStats, eventsResponse));
  }

  // Aggregate per-match player stats into season totals
  const playerTotals = {};
  for (const matchPlayers of Object.values(playerMatchStats)) {
    for (const p of matchPlayers) {
      const key = `${p.playerId}|${p.name}`;
      if (!playerTotals[key]) {
        playerTotals[key] = {
          id: p.playerId,
          name: p.name,
          club: "Arsenal",
          position: "UNK",
          nationality: "Unknown",
          age: null,
          number: null,
          image: null,
          stats: {
            appearances: 0, minutesPlayed: 0, goals: 0, assists: 0,
            shots: 0, shotsOnTarget: 0, keyPasses: 0, passes: 0,
            tackles: 0, interceptions: 0, aerialWon: 0, dribbles: 0,
            dribbleSuccess: 0, yellowCards: 0, redCards: 0
          },
          radar: {},
          form: []
        };
      }
      const t = playerTotals[key];
      if (p.minutesPlayed > 0) t.stats.appearances += 1;
      t.stats.minutesPlayed += p.minutesPlayed;
      t.stats.goals += p.goals;
      t.stats.assists += p.assists;
      t.stats.shots += p.shots;
      t.stats.shotsOnTarget += p.shotsOnTarget;
      t.stats.keyPasses += p.keyPasses;
      t.stats.passes += p.passes;
      t.stats.tackles += p.tackles;
      t.stats.interceptions += p.interceptions;
      t.stats.aerialWon += p.aerialWon;
      t.stats.dribbles += p.dribbles;
      t.stats.dribbleSuccess += p.dribbleSuccess;
      t.stats.yellowCards += p.yellowCards;
      t.stats.redCards += p.redCards;
    }
  }

  const players = Object.values(playerTotals);
  console.log(`[apiFootball] done. ${requestCount} requests. ${matches.length} matches, ${players.length} players.`);

  return { players, matches, shots: [], seasonStats: null, playerMatchStats };
}

module.exports = { fetchApiFootballData };
