const FOOTBALL_DATA_BASE_URL = "https://api.football-data.org/v4";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeTeamLabel(name) {
  return String(name || "")
    .replace(/\bFC\b/g, "")
    .replace(/\bAFC\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseNumericStat(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace("%", "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  if (isObject(value)) {
    if (Number.isFinite(Number(value.value))) return Number(value.value);
    if (Number.isFinite(Number(value.total))) return Number(value.total);
  }
  return null;
}

function mapStatKey(rawKey) {
  const key = normalizeKey(rawKey);
  if (key.includes("expected goals") || key === "xg") return "xG";
  if (key.includes("shots on target") || key.includes("shots on goal")) return "shotsOnTarget";
  if (key === "shots" || key.includes("total shots")) return "shots";
  if (key.includes("ball possession") || key === "possession") return "possession";
  if (key.includes("pass accuracy") || key.includes("pass completion")) return "passAccuracy";
  if (key === "passes" || key.includes("total passes")) return "passes";
  if (key.includes("corner")) return "corners";
  if (key.includes("fouls")) return "fouls";
  if (key === "ppda") return "ppda";
  return null;
}

function asTeamStatsBucket() {
  return {};
}

function assignStat(bucket, rawKey, rawValue) {
  const mappedKey = mapStatKey(rawKey);
  if (!mappedKey) return;
  const parsed = parseNumericStat(rawValue);
  if (parsed === null) return;
  bucket[mappedKey] = Number.isInteger(parsed) ? parsed : Number(parsed.toFixed(2));
}

function toMatchTeamStats(rawMatch) {
  const home = asTeamStatsBucket();
  const away = asTeamStatsBucket();

  const homeId = toNumber(rawMatch?.homeTeam?.id, null);
  const awayId = toNumber(rawMatch?.awayTeam?.id, null);

  const statisticsList = Array.isArray(rawMatch?.statistics) ? rawMatch.statistics : [];
  if (statisticsList.length > 0) {
    for (let index = 0; index < statisticsList.length; index += 1) {
      const entry = statisticsList[index] || {};
      const statsRows = Array.isArray(entry.statistics)
        ? entry.statistics
        : Array.isArray(entry.stats)
          ? entry.stats
          : [];

      let bucket = null;
      const entryTeamId = toNumber(entry?.team?.id, null);
      if (entryTeamId !== null && homeId !== null && entryTeamId === homeId) bucket = home;
      else if (entryTeamId !== null && awayId !== null && entryTeamId === awayId) bucket = away;
      else bucket = index === 0 ? home : away;

      for (const row of statsRows) {
        assignStat(bucket, row?.type || row?.name || row?.stat, row?.value);
      }
    }
  }

  const objStats = isObject(rawMatch?.stats) ? rawMatch.stats : isObject(rawMatch?.statistics) ? rawMatch.statistics : {};
  const homeObj = isObject(objStats.home) ? objStats.home : isObject(objStats.homeTeam) ? objStats.homeTeam : null;
  const awayObj = isObject(objStats.away) ? objStats.away : isObject(objStats.awayTeam) ? objStats.awayTeam : null;

  if (homeObj) {
    for (const [key, value] of Object.entries(homeObj)) {
      assignStat(home, key, value);
    }
  }
  if (awayObj) {
    for (const [key, value] of Object.entries(awayObj)) {
      assignStat(away, key, value);
    }
  }

  const hasHome = Object.keys(home).length > 0;
  const hasAway = Object.keys(away).length > 0;
  if (!hasHome && !hasAway) return {};
  return {
    ...(hasHome ? { home } : {}),
    ...(hasAway ? { away } : {})
  };
}

function normalizeGoalEvent(goal, fallbackTeam) {
  const minute = toNumber(goal?.minute, 0) + toNumber(goal?.injuryTime, 0);
  const team = normalizeTeamLabel(goal?.team?.name || fallbackTeam || "");
  const scorerName = goal?.scorer?.name || goal?.player?.name || goal?.scorer || "";
  const assistName = goal?.assist?.name || goal?.assist || "";
  return {
    scorer: scorerName
      ? {
          playerId: Number.isFinite(Number(goal?.scorer?.id)) ? Number(goal.scorer.id) : undefined,
          player: scorerName,
          minute,
          team: team || fallbackTeam || "Arsenal"
        }
      : null,
    assist: assistName
      ? {
          playerId: Number.isFinite(Number(goal?.assist?.id)) ? Number(goal.assist.id) : undefined,
          player: assistName,
          minute,
          team: team || fallbackTeam || "Arsenal"
        }
      : null,
    keyMoment: {
      minute,
      type: "goal",
      team: team || fallbackTeam || "Arsenal",
      player: scorerName || undefined,
      note: goal?.type || undefined
    }
  };
}

function toMatchDetails(rawMatch) {
  const details = {
    attendance: Number.isFinite(Number(rawMatch?.attendance)) ? Number(rawMatch.attendance) : undefined,
    kickoffUtc: rawMatch?.utcDate || undefined,
    stats: toMatchTeamStats(rawMatch),
    scorers: [],
    assists: [],
    keyMoments: [],
    xgTimeline: []
  };

  const goals = Array.isArray(rawMatch?.goals) ? rawMatch.goals : [];
  for (const goal of goals) {
    const event = normalizeGoalEvent(goal);
    if (event.scorer) details.scorers.push(event.scorer);
    if (event.assist) details.assists.push(event.assist);
    details.keyMoments.push(event.keyMoment);
  }

  const bookings = Array.isArray(rawMatch?.bookings) ? rawMatch.bookings : [];
  for (const booking of bookings) {
    details.keyMoments.push({
      minute: toNumber(booking?.minute, 0),
      type: "card",
      team: normalizeTeamLabel(booking?.team?.name || ""),
      player: booking?.player?.name || booking?.player || undefined,
      note: booking?.card || undefined
    });
  }

  details.keyMoments.sort((a, b) => toNumber(a.minute, 0) - toNumber(b.minute, 0));
  return details;
}

function mapPosition(position) {
  const normalized = normalizeKey(position);
  if (normalized.includes("goalkeeper")) return "GK";
  if (normalized.includes("defence") || normalized.includes("defender")) return "DEF";
  if (normalized.includes("midfield")) return "MID";
  if (normalized.includes("offence") || normalized.includes("forward") || normalized.includes("striker")) return "FWD";
  return "UNK";
}

function toAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  const dayDiff = now.getUTCDate() - birth.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age >= 0 ? age : null;
}

function normalizeSquadPlayer(player, clubName) {
  return {
    id: toNumber(player?.id),
    name: player?.name || "",
    position: mapPosition(player?.position),
    number: Number.isFinite(Number(player?.shirtNumber)) ? Number(player.shirtNumber) : null,
    nationality: player?.nationality || "Unknown",
    age: toAge(player?.dateOfBirth),
    image: null,
    club: clubName,
    stats: {},
    radar: {},
    form: []
  };
}

class Throttler {
  constructor(minIntervalMs) {
    this.minIntervalMs = minIntervalMs;
    this.lastRunAt = 0;
    this.queue = Promise.resolve();
  }

  async waitTurn() {
    this.queue = this.queue.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastRunAt;
      const waitFor = this.minIntervalMs - elapsed;
      if (waitFor > 0) await sleep(waitFor);
      this.lastRunAt = Date.now();
    });
    await this.queue;
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
  const details = isObject(match.__details) ? match.__details : {};
  const homeScore = toNumber(match.score?.fullTime?.home, 0);
  const awayScore = toNumber(match.score?.fullTime?.away, 0);

  return {
    id: toNumber(match.id),
    date: String(match.utcDate || "").slice(0, 10),
    kickoffUtc: details.kickoffUtc || match.utcDate || undefined,
    competition: match.competition?.name || "Premier League",
    matchweek: toNumber(match.matchday, 0),
    venue: normalizeTeamLabel(match.venue || match.homeTeam?.name || ""),
    homeTeam: normalizeTeamLabel(match.homeTeam?.name || ""),
    awayTeam: normalizeTeamLabel(match.awayTeam?.name || ""),
    homeScore,
    awayScore,
    result: computeResultFromArsenalPerspective(match, arsenalTeamId),
    resultFromArsenalView: computeResultFromArsenalPerspective(match, arsenalTeamId),
    attendance:
      Number.isFinite(Number(details.attendance)) ? Number(details.attendance) : Number.isFinite(Number(match.attendance)) ? Number(match.attendance) : undefined,
    stats: isObject(details.stats) ? details.stats : {},
    scorers: Array.isArray(details.scorers) ? details.scorers : [],
    assists: Array.isArray(details.assists) ? details.assists : [],
    xgTimeline: Array.isArray(details.xgTimeline) ? details.xgTimeline : [],
    keyMoments: Array.isArray(details.keyMoments) ? details.keyMoments : []
  };
}

function normalizeSeasonStats(standingsTable, arsenalName) {
  const normalizedArsenal = normalizeTeamLabel(arsenalName);
  const row = (standingsTable || []).find((entry) => {
    const teamName = normalizeTeamLabel(entry.team?.name || "");
    return teamName === normalizedArsenal;
  });
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

function deriveSeasonDetails(matches, arsenalName) {
  const normalizedArsenal = normalizeTeamLabel(arsenalName);
  const sorted = (matches || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const form = [];
  let cleanSheets = 0;

  for (const match of sorted) {
    const isHome = normalizeTeamLabel(match.homeTeam) === normalizedArsenal;
    const isAway = normalizeTeamLabel(match.awayTeam) === normalizedArsenal;
    if (!isHome && !isAway) continue;
    const gf = isHome ? toNumber(match.homeScore) : toNumber(match.awayScore);
    const ga = isHome ? toNumber(match.awayScore) : toNumber(match.homeScore);
    if (ga === 0) cleanSheets += 1;
    if (gf > ga) form.push("W");
    else if (gf < ga) form.push("L");
    else form.push("D");
  }

  return { cleanSheets, form };
}

async function fetchMatchDetails(matchIds, { apiKey, retries, backoffMs }, throttler) {
  const detailsById = new Map();
  for (const matchId of matchIds) {
    if (!Number.isFinite(Number(matchId))) continue;
    try {
      const payload = await requestWithRetry(
        `/matches/${matchId}`,
        { apiKey, retries, backoffMs },
        throttler
      );
      const rawMatch = payload?.match || payload;
      detailsById.set(Number(matchId), toMatchDetails(rawMatch));
    } catch (err) {
      console.warn(`[footballData] match ${matchId} detail unavailable: ${err.message}`);
    }
  }
  return detailsById;
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
    matchLimit: options.matchLimit ?? 50,
    detailMatchCount: options.detailMatchCount ?? 6,
    retries: options.retries ?? 3,
    backoffMs: options.backoffMs ?? 700
  };

  const throttler = new Throttler(config.minIntervalMs);

  const requestConfig = { apiKey, retries: config.retries, backoffMs: config.backoffMs };
  const matchPayload = await requestWithRetry(
    `/teams/${config.arsenalTeamId}/matches?status=FINISHED&limit=${config.matchLimit}`,
    requestConfig,
    throttler
  );
  const standingsPayload = await requestWithRetry(`/competitions/PL/standings`, requestConfig, throttler);
  const squadPayload = await requestWithRetry(`/teams/${config.arsenalTeamId}`, requestConfig, throttler);

  const rawMatches = Array.isArray(matchPayload.matches) ? matchPayload.matches : [];
  const detailIds = rawMatches.slice(0, config.detailMatchCount).map((match) => match?.id);
  const detailsById = await fetchMatchDetails(detailIds, requestConfig, throttler);
  const enrichedRawMatches = rawMatches.map((match) => ({
    ...match,
    __details: detailsById.get(Number(match.id))
  }));

  const matches = enrichedRawMatches.map((match) => normalizeMatch(match, config.arsenalTeamId));
  const seasonStats = normalizeSeasonStats(standingsPayload.standings?.[0]?.table, config.arsenalName);
  const derived = deriveSeasonDetails(matches, config.arsenalName);
  if (seasonStats) {
    if (toNumber(seasonStats.cleanSheets) === 0 && derived.cleanSheets > 0) {
      seasonStats.cleanSheets = derived.cleanSheets;
    }
    if ((!Array.isArray(seasonStats.form) || seasonStats.form.length === 0) && derived.form.length > 0) {
      seasonStats.form = derived.form;
    }
  }

  const normalizedClubName = normalizeTeamLabel(config.arsenalName) || "Arsenal";
  const players = (squadPayload.squad || []).map((player) =>
    normalizeSquadPlayer(player, normalizedClubName)
  );

  return {
    players,
    matches,
    seasonStats,
    shots: []
  };
}

module.exports = {
  fetchFootballData
};
