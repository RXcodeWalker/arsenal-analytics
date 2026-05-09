const fs = require("node:fs/promises");
const path = require("node:path");
const { TRANSFER_TARGETS: DEFAULT_TRANSFER_TARGETS } = require("../pipeline/transferTargets");

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isString(value) {
  return typeof value === "string";
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isInt(value) {
  return Number.isInteger(value);
}

function readDateString(value) {
  if (!isString(value)) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function writePrettyJson(filePath, payload) {
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(filePath, json, "utf8");
}

function pushError(errors, schemaName, field, message) {
  errors.push({
    schema: schemaName,
    field,
    message
  });
}

function validateMatch(match, errors) {
  let valid = true;
  const required = [
    "id",
    "date",
    "competition",
    "matchweek",
    "venue",
    "homeTeam",
    "awayTeam",
    "homeScore",
    "awayScore",
    "resultFromArsenalView",
    "stats",
    "scorers",
    "assists",
    "xgTimeline",
    "keyMoments"
  ];
  for (const key of required) {
    if (match[key] === undefined || match[key] === null) {
      valid = false;
      pushError(errors, "match", key, "Missing required field");
    }
  }

  if (!isInt(match.id)) {
    valid = false;
    pushError(errors, "match", "id", "Must be integer");
  }
  if (!readDateString(match.date)) {
    valid = false;
    pushError(errors, "match", "date", "Must be YYYY-MM-DD");
  }
  if (!isString(match.competition)) {
    valid = false;
    pushError(errors, "match", "competition", "Must be string");
  }
  if (!isInt(match.matchweek)) {
    valid = false;
    pushError(errors, "match", "matchweek", "Must be integer");
  }
  if (!isString(match.venue)) {
    valid = false;
    pushError(errors, "match", "venue", "Must be string");
  }
  if (!isString(match.homeTeam) || !isString(match.awayTeam)) {
    valid = false;
    pushError(errors, "match", "homeTeam/awayTeam", "Must be strings");
  }
  if (!isInt(match.homeScore) || !isInt(match.awayScore)) {
    valid = false;
    pushError(errors, "match", "homeScore/awayScore", "Must be integers");
  }
  if (!["W", "D", "L"].includes(match.resultFromArsenalView)) {
    valid = false;
    pushError(errors, "match", "resultFromArsenalView", "Must be one of W, D, L");
  }
  if (match.attendance !== undefined && !isInt(match.attendance)) {
    valid = false;
    pushError(errors, "match", "attendance", "Must be integer when provided");
  }

  if (!isObject(match.stats)) {
    valid = false;
    pushError(errors, "match", "stats", "Must be object");
  }

  if (!Array.isArray(match.scorers)) {
    valid = false;
    pushError(errors, "match", "scorers", "Must be array");
  }
  if (!Array.isArray(match.assists)) {
    valid = false;
    pushError(errors, "match", "assists", "Must be array");
  }
  if (!Array.isArray(match.xgTimeline)) {
    valid = false;
    pushError(errors, "match", "xgTimeline", "Must be array");
  }
  if (!Array.isArray(match.keyMoments)) {
    valid = false;
    pushError(errors, "match", "keyMoments", "Must be array");
  }

  return valid;
}

function validatePlayer(player, errors) {
  let valid = true;
  const required = ["id", "name", "position", "nationality", "stats", "radar", "form"];
  for (const key of required) {
    if (player[key] === undefined || player[key] === null) {
      valid = false;
      pushError(errors, "player", key, "Missing required field");
    }
  }

  if (!isInt(player.id)) {
    valid = false;
    pushError(errors, "player", "id", "Must be integer");
  }
  if (!isString(player.name) || !player.name.trim()) {
    valid = false;
    pushError(errors, "player", "name", "Must be non-empty string");
  }
  if (!isString(player.position)) {
    valid = false;
    pushError(errors, "player", "position", "Must be string");
  }
  if (!isString(player.nationality)) {
    valid = false;
    pushError(errors, "player", "nationality", "Must be string");
  }
  if (!(isInt(player.age) || player.age === null)) {
    valid = false;
    pushError(errors, "player", "age", "Must be integer or null");
  }
  if (player.number !== undefined && !(isInt(player.number) || player.number === null)) {
    valid = false;
    pushError(errors, "player", "number", "Must be integer or null");
  }
  if (player.marketValue !== undefined && !(isNumber(player.marketValue) || player.marketValue === null)) {
    valid = false;
    pushError(errors, "player", "marketValue", "Must be number or null");
  }
  if (!isObject(player.stats)) {
    valid = false;
    pushError(errors, "player", "stats", "Must be object");
  }
  if (!isObject(player.radar)) {
    valid = false;
    pushError(errors, "player", "radar", "Must be object");
  }
  if (!Array.isArray(player.form)) {
    valid = false;
    pushError(errors, "player", "form", "Must be array");
  }

  return valid;
}

function validateShot(shot, errors) {
  let valid = true;
  const required = ["id", "matchId", "player", "team", "minute", "x", "y", "xG", "outcome"];
  for (const key of required) {
    if (shot[key] === undefined || shot[key] === null) {
      valid = false;
      pushError(errors, "shot", key, "Missing required field");
    }
  }

  if (!isInt(shot.id)) {
    valid = false;
    pushError(errors, "shot", "id", "Must be integer");
  }
  if (!isInt(shot.matchId)) {
    valid = false;
    pushError(errors, "shot", "matchId", "Must be integer");
  }
  if (shot.playerId !== undefined && !isInt(shot.playerId)) {
    valid = false;
    pushError(errors, "shot", "playerId", "Must be integer");
  }
  if (!isString(shot.player) || !shot.player.trim()) {
    valid = false;
    pushError(errors, "shot", "player", "Must be non-empty string");
  }
  if (!isString(shot.team) || !shot.team.trim()) {
    valid = false;
    pushError(errors, "shot", "team", "Must be non-empty string");
  }
  if (!isInt(shot.minute)) {
    valid = false;
    pushError(errors, "shot", "minute", "Must be integer");
  }
  if (!isNumber(shot.x) || shot.x < 0 || shot.x > 100) {
    valid = false;
    pushError(errors, "shot", "x", "Must be number between 0 and 100");
  }
  if (!isNumber(shot.y) || shot.y < 0 || shot.y > 100) {
    valid = false;
    pushError(errors, "shot", "y", "Must be number between 0 and 100");
  }
  if (!isNumber(shot.xG)) {
    valid = false;
    pushError(errors, "shot", "xG", "Must be number");
  }
  if (!isString(shot.outcome)) {
    valid = false;
    pushError(errors, "shot", "outcome", "Must be string");
  }

  return valid;
}

function validateCollection(items, validator, schemaName) {
  const errors = [];
  if (!Array.isArray(items)) {
    pushError(errors, schemaName, schemaName, "Payload must be an array");
    return { valid: false, errors };
  }

  const valid = items.every((item) => validator(item, errors));

  return { valid: valid && errors.length === 0, errors };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateSourceMeta(sourceMeta, errors) {
  if (!isObject(sourceMeta)) {
    pushError(errors, "meta", "sourceMeta", "Must be object");
    return false;
  }
  if (!Array.isArray(sourceMeta.statuses)) {
    pushError(errors, "meta", "sourceMeta.statuses", "Must be array");
    return false;
  }
  for (const status of sourceMeta.statuses) {
    if (!isObject(status)) {
      pushError(errors, "meta", "sourceMeta.statuses[]", "Status must be object");
      continue;
    }
    if (!isString(status.provider) || !status.provider) {
      pushError(errors, "meta", "sourceMeta.statuses[].provider", "Must be string");
    }
    if (!isString(status.fetchedAt) || !status.fetchedAt) {
      pushError(errors, "meta", "sourceMeta.statuses[].fetchedAt", "Must be string");
    }
    if (typeof status.ok !== "boolean") {
      pushError(errors, "meta", "sourceMeta.statuses[].ok", "Must be boolean");
    }
  }
  return true;
}

function normalizeMatch(input) {
  return {
    id: input.id,
    externalIds: isObject(input.externalIds) ? input.externalIds : undefined,
    date: input.date,
    kickoffUtc: input.kickoffUtc,
    competition: input.competition,
    matchweek: input.matchweek,
    venue: input.venue,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    resultFromArsenalView: input.resultFromArsenalView || input.result,
    attendance: input.attendance,
    stats: isObject(input.stats) ? input.stats : {},
    scorers: Array.isArray(input.scorers) ? input.scorers : [],
    assists: Array.isArray(input.assists) ? input.assists : [],
    xgTimeline: Array.isArray(input.xgTimeline) ? input.xgTimeline : [],
    keyMoments: Array.isArray(input.keyMoments) ? input.keyMoments : []
  };
}

function normalizePlayer(input) {
  const player = { ...input };
  player.form = Array.isArray(player.form) ? player.form : [];
  return player;
}

function normalizeShot(input) {
  return {
    id: input.id,
    matchId: input.matchId,
    playerId: input.playerId,
    player: input.player,
    team: input.team || "Arsenal",
    minute: input.minute ?? 0,
    x: input.x,
    y: input.y,
    xG: input.xG,
    outcome: input.outcome,
    bodyPart: input.bodyPart,
    playType: input.playType || input.type,
    period: input.period
  };
}

function normalizeSeasonStats(input) {
  const base = isObject(input) ? input : {};
  // ppda is only available from FBref (blocked) — keep null rather than defaulting to 0
  const ppdaRaw = base.ppda;
  const ppda = (ppdaRaw === null || ppdaRaw === undefined) ? null : toNum(ppdaRaw);
  return {
    played: toInt(base.played),
    won: toInt(base.won),
    drawn: toInt(base.drawn),
    lost: toInt(base.lost),
    goalsFor: toInt(base.goalsFor),
    goalsAgainst: toInt(base.goalsAgainst),
    points: toInt(base.points),
    position: toInt(base.position),
    cleanSheets: toInt(base.cleanSheets),
    xGFor: toNum(base.xGFor),
    xGAgainst: toNum(base.xGAgainst),
    avgPossession: toNum(base.avgPossession),
    ppda,
    fieldTilt: toNum(base.fieldTilt),
    form: Array.isArray(base.form) ? base.form.filter((r) => ["W", "D", "L"].includes(r)) : [],
    monthlyXG: Array.isArray(base.monthlyXG) ? base.monthlyXG : []
  };
}

function toInt(value) {
  return Number.isInteger(value) ? value : 0;
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildPlayerShotSummary(shots) {
  const byPlayer = new Map();
  for (const shot of shots) {
    const playerKey = `${shot.playerId ?? "na"}|${shot.player}`;
    if (!byPlayer.has(playerKey)) {
      byPlayer.set(playerKey, {
        playerId: shot.playerId ?? -1,
        player: shot.player,
        shots: 0,
        goals: 0,
        totalXG: 0
      });
    }
    const row = byPlayer.get(playerKey);
    row.shots += 1;
    row.totalXG += toNum(shot.xG);
    if (shot.outcome === "Goal") row.goals += 1;
  }

  return [...byPlayer.values()].map((row) => ({
    ...row,
    avgXGPerShot: row.shots > 0 ? Number((row.totalXG / row.shots).toFixed(3)) : 0,
    totalXG: Number(row.totalXG.toFixed(3))
  }));
}

function buildMatchShotSummary(shots) {
  const byMatch = new Map();
  for (const shot of shots) {
    if (!byMatch.has(shot.matchId)) {
      byMatch.set(shot.matchId, {
        matchId: shot.matchId,
        totalShots: 0,
        totalGoals: 0,
        totalXG: 0
      });
    }
    const row = byMatch.get(shot.matchId);
    row.totalShots += 1;
    row.totalXG += toNum(shot.xG);
    if (shot.outcome === "Goal") row.totalGoals += 1;
  }
  return [...byMatch.values()].map((row) => ({
    ...row,
    totalXG: Number(row.totalXG.toFixed(3))
  }));
}

function computeQualityReport({ players, matches, shots, sourceMeta }) {
  const playersSafe = Array.isArray(players) ? players : [];
  const matchesSafe = Array.isArray(matches) ? matches : [];
  const shotsSafe = Array.isArray(shots) ? shots : [];
  const statuses = Array.isArray(sourceMeta?.statuses) ? sourceMeta.statuses : [];

  const playersWithNullNumber = playersSafe.filter((p) => p.number === null || p.number === undefined).length;
  const playersWithNullAge = playersSafe.filter((p) => p.age === null || p.age === undefined).length;
  const playersWithUnknownNationality = playersSafe.filter(
    (p) => String(p.nationality || "").trim().toLowerCase() === "unknown"
  ).length;
  const matchesMissingStats = matchesSafe.filter((m) => !isObject(m.stats?.home) || !isObject(m.stats?.away)).length;
  const matchesMissingTimeline = matchesSafe.filter((m) => !Array.isArray(m.xgTimeline) || m.xgTimeline.length === 0).length;
  const failedProviders = statuses.filter((s) => s && s.ok === false).map((s) => s.provider);

  return {
    players: {
      total: playersSafe.length,
      withNullNumber: playersWithNullNumber,
      withNullAge: playersWithNullAge,
      withUnknownNationality: playersWithUnknownNationality
    },
    matches: {
      total: matchesSafe.length,
      missingStats: matchesMissingStats,
      missingTimeline: matchesMissingTimeline
    },
    shots: {
      total: shotsSafe.length
    },
    providers: {
      failed: failedProviders
    }
  };
}

function validateSeasonStats(stats, errors) {
  let valid = true;
  const requiredNumeric = [
    "played",
    "won",
    "drawn",
    "lost",
    "goalsFor",
    "goalsAgainst",
    "points",
    "position",
    "cleanSheets",
    "xGFor",
    "xGAgainst",
    "avgPossession",
    "ppda",
    "fieldTilt"
  ];

  for (const key of requiredNumeric) {
    // ppda may be null when FBref is unavailable — null is an acceptable "no data" value
    if (key === "ppda" && stats[key] === null) continue;
    if (!isNumber(stats[key]) && !isInt(stats[key])) {
      valid = false;
      pushError(errors, "seasonStats", key, "Must be numeric");
    }
  }

  if (!Array.isArray(stats.form)) {
    valid = false;
    pushError(errors, "seasonStats", "form", "Must be array");
  }
  if (!Array.isArray(stats.monthlyXG)) {
    valid = false;
    pushError(errors, "seasonStats", "monthlyXG", "Must be array");
  }
  return valid;
}

function validateEnvelopeBase(file, errors) {
  let valid = true;
  if (!isObject(file)) {
    pushError(errors, "meta", "file", "Must be object");
    return false;
  }
  if (!isString(file.schemaVersion) || !file.schemaVersion) {
    valid = false;
    pushError(errors, "meta", "schemaVersion", "Must be non-empty string");
  }
  if (!isString(file.generatedAt) || !file.generatedAt) {
    valid = false;
    pushError(errors, "meta", "generatedAt", "Must be non-empty string");
  }
  if (!isString(file.season) || !file.season) {
    valid = false;
    pushError(errors, "meta", "season", "Must be non-empty string");
  }
  if (!validateSourceMeta(file.sourceMeta, errors)) {
    valid = false;
  }
  return valid;
}

function validatePlayersFile(file) {
  const errors = [];
  const baseOk = validateEnvelopeBase(file, errors);
  const collection = validateCollection(file.players, validatePlayer, "player");
  return { valid: baseOk && collection.valid, errors: [...errors, ...collection.errors] };
}

function validateMatchesFile(file) {
  const errors = [];
  const baseOk = validateEnvelopeBase(file, errors);
  const matchResult = validateCollection(file.matches, validateMatch, "match");
  const seasonOk = validateSeasonStats(file.seasonStats, errors);
  return { valid: baseOk && seasonOk && matchResult.valid, errors: [...errors, ...matchResult.errors] };
}

function validateShotsFile(file) {
  const errors = [];
  const baseOk = validateEnvelopeBase(file, errors);
  const shotResult = validateCollection(file.shots, validateShot, "shot");

  if (!Array.isArray(file.playerShotSummary)) {
    pushError(errors, "shots", "playerShotSummary", "Must be array");
  }
  if (!Array.isArray(file.matchShotSummary)) {
    pushError(errors, "shots", "matchShotSummary", "Must be array");
  }
  if (!Array.isArray(file.transferTargets)) {
    pushError(errors, "shots", "transferTargets", "Must be array");
  } else {
    for (const target of file.transferTargets) {
      if (!isObject(target)) {
        pushError(errors, "shots", "transferTargets[]", "Each target must be object");
        continue;
      }
      if (!isInt(target.id)) pushError(errors, "shots", "transferTargets[].id", "Must be integer");
      if (!isString(target.name) || !target.name) pushError(errors, "shots", "transferTargets[].name", "Must be non-empty string");
      if (!isObject(target.stats)) pushError(errors, "shots", "transferTargets[].stats", "Must be object");
      if (!isObject(target.radar)) pushError(errors, "shots", "transferTargets[].radar", "Must be object");
      if (!isObject(target.scouting)) pushError(errors, "shots", "transferTargets[].scouting", "Must be object");
    }
  }

  return {
    valid: baseOk && shotResult.valid && errors.length === 0,
    errors: [...errors, ...shotResult.errors]
  };
}

function throwIfInvalid(result, fileName) {
  if (result.valid) return;
  const detail = result.errors
    .map((err) => `[${err.schema}] field=${err.field} message=${err.message}`)
    .join("\n");
  throw new Error(`[dataWriter] ${fileName} schema validation failed:\n${detail}`);
}

async function writeCanonicalData({
  players,
  matches,
  shots,
  seasonStats,
  sourceMeta,
  generatedAt,
  season,
  transferTargets = [],
  dataDir = path.resolve(process.cwd(), "data")
}) {
  assert(generatedAt && season && isObject(sourceMeta), "generatedAt, season, sourceMeta are required");

  const normalizedPlayersRaw = Array.isArray(players)
    ? players
    : isObject(players) && Array.isArray(players.players)
      ? players.players
      : [];
  const normalizedMatchesRaw = Array.isArray(matches)
    ? matches
    : isObject(matches) && Array.isArray(matches.matches)
      ? matches.matches
      : [];
  const normalizedShotsRaw = Array.isArray(shots)
    ? shots
    : isObject(shots) && Array.isArray(shots.shots)
      ? shots.shots
      : [];

  const normalizedPlayers = normalizedPlayersRaw.map(normalizePlayer);
  const normalizedMatches = normalizedMatchesRaw.map(normalizeMatch);
  const normalizedShots = normalizedShotsRaw.map(normalizeShot);
  const normalizedSeasonStats = normalizeSeasonStats(seasonStats);

  const playersFile = {
    schemaVersion: "2.0.0",
    generatedAt,
    season,
    sourceMeta,
    players: normalizedPlayers
  };

  const matchesFile = {
    schemaVersion: "2.0.0",
    generatedAt,
    season,
    sourceMeta,
    seasonStats: normalizedSeasonStats,
    matches: normalizedMatches
  };

  const shotsFile = {
    schemaVersion: "2.0.0",
    generatedAt,
    season,
    sourceMeta,
    shots: normalizedShots,
    playerShotSummary: buildPlayerShotSummary(normalizedShots),
    matchShotSummary: buildMatchShotSummary(normalizedShots),
    transferTargets: Array.isArray(transferTargets) && transferTargets.length > 0 ? transferTargets : DEFAULT_TRANSFER_TARGETS
  };

  throwIfInvalid(validatePlayersFile(playersFile), "players.json");
  throwIfInvalid(validateMatchesFile(matchesFile), "matches.json");
  throwIfInvalid(validateShotsFile(shotsFile), "shots.json");

  const playersPath = path.join(dataDir, "players.json");
  const matchesPath = path.join(dataDir, "matches.json");
  const shotsPath = path.join(dataDir, "shots.json");
  await fs.mkdir(dataDir, { recursive: true });

  await Promise.all([
    writePrettyJson(playersPath, playersFile),
    writePrettyJson(matchesPath, matchesFile),
    writePrettyJson(shotsPath, shotsFile)
  ]);

  return {
    players: { written: true, usedFallback: false, errors: [] },
    matches: { written: true, usedFallback: false, errors: [] },
    shots: { written: true, usedFallback: false, errors: [] }
  };
}

module.exports = {
  writeCanonicalData,
  validateMatch,
  validatePlayer,
  validateShot,
  computeQualityReport
};

