const fs = require("node:fs/promises");
const path = require("node:path");

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

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

async function writePrettyJson(filePath, payload) {
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(filePath, json, "utf8");
}

function pushError(errors, schemaName, index, field, message) {
  errors.push({
    schema: schemaName,
    index,
    field,
    message
  });
}

function validateStatsBlock(stats) {
  if (stats === undefined) return true;
  if (!isObject(stats)) return false;
  return true;
}

function validateMatch(match, index, errors) {
  let valid = true;

  const required = ["id", "date", "competition", "matchweek", "venue", "homeTeam", "awayTeam", "homeScore", "awayScore", "result"];
  for (const key of required) {
    if (match[key] === undefined || match[key] === null) {
      valid = false;
      pushError(errors, "match", index, key, "Missing required field");
    }
  }

  if (!isInt(match.id)) {
    valid = false;
    pushError(errors, "match", index, "id", "Must be integer");
  }
  if (!readDateString(match.date)) {
    valid = false;
    pushError(errors, "match", index, "date", "Must be YYYY-MM-DD");
  }
  if (!isString(match.competition)) {
    valid = false;
    pushError(errors, "match", index, "competition", "Must be string");
  }
  if (!isInt(match.matchweek)) {
    valid = false;
    pushError(errors, "match", index, "matchweek", "Must be integer");
  }
  if (!isString(match.venue)) {
    valid = false;
    pushError(errors, "match", index, "venue", "Must be string");
  }
  if (!isString(match.homeTeam) || !isString(match.awayTeam)) {
    valid = false;
    pushError(errors, "match", index, "homeTeam/awayTeam", "Must be strings");
  }
  if (!isInt(match.homeScore) || !isInt(match.awayScore)) {
    valid = false;
    pushError(errors, "match", index, "homeScore/awayScore", "Must be integers");
  }
  if (!["W", "D", "L"].includes(match.result)) {
    valid = false;
    pushError(errors, "match", index, "result", "Must be one of W, D, L");
  }
  if (match.attendance !== undefined && !isInt(match.attendance)) {
    valid = false;
    pushError(errors, "match", index, "attendance", "Must be integer when provided");
  }

  if (match.stats !== undefined) {
    if (!isObject(match.stats)) {
      valid = false;
      pushError(errors, "match", index, "stats", "Must be object");
    } else {
      if (!validateStatsBlock(match.stats.home)) {
        valid = false;
        pushError(errors, "match", index, "stats.home", "Must be object");
      }
      if (!validateStatsBlock(match.stats.away)) {
        valid = false;
        pushError(errors, "match", index, "stats.away", "Must be object");
      }
    }
  }

  if (match.scorers !== undefined && !Array.isArray(match.scorers)) {
    valid = false;
    pushError(errors, "match", index, "scorers", "Must be array");
  }
  if (match.assists !== undefined && !Array.isArray(match.assists)) {
    valid = false;
    pushError(errors, "match", index, "assists", "Must be array");
  }
  if (match.xgTimeline !== undefined && !Array.isArray(match.xgTimeline)) {
    valid = false;
    pushError(errors, "match", index, "xgTimeline", "Must be array");
  }
  if (match.keyMoments !== undefined && !Array.isArray(match.keyMoments)) {
    valid = false;
    pushError(errors, "match", index, "keyMoments", "Must be array");
  }

  return valid;
}

function validatePlayer(player, index, errors) {
  let valid = true;
  const required = ["id", "name", "position", "nationality", "age", "stats", "radar"];
  for (const key of required) {
    if (player[key] === undefined || player[key] === null) {
      valid = false;
      pushError(errors, "player", index, key, "Missing required field");
    }
  }

  if (!isInt(player.id)) {
    valid = false;
    pushError(errors, "player", index, "id", "Must be integer");
  }
  if (!isString(player.name) || !player.name.trim()) {
    valid = false;
    pushError(errors, "player", index, "name", "Must be non-empty string");
  }
  if (!isString(player.position)) {
    valid = false;
    pushError(errors, "player", index, "position", "Must be string");
  }
  if (!isString(player.nationality)) {
    valid = false;
    pushError(errors, "player", index, "nationality", "Must be string");
  }
  if (!(isInt(player.age) || player.age === null)) {
    valid = false;
    pushError(errors, "player", index, "age", "Must be integer or null");
  }
  if (player.number !== undefined && !(isInt(player.number) || player.number === null)) {
    valid = false;
    pushError(errors, "player", index, "number", "Must be integer or null");
  }
  if (player.marketValue !== undefined && !(isNumber(player.marketValue) || player.marketValue === null)) {
    valid = false;
    pushError(errors, "player", index, "marketValue", "Must be number or null");
  }
  if (!isObject(player.stats)) {
    valid = false;
    pushError(errors, "player", index, "stats", "Must be object");
  }
  if (!isObject(player.radar)) {
    valid = false;
    pushError(errors, "player", index, "radar", "Must be object");
  }
  if (player.form !== undefined && !Array.isArray(player.form)) {
    valid = false;
    pushError(errors, "player", index, "form", "Must be array");
  }

  return valid;
}

function validateShot(shot, index, errors) {
  let valid = true;
  const required = ["id", "player", "x", "y", "xG", "outcome"];
  for (const key of required) {
    if (shot[key] === undefined || shot[key] === null) {
      valid = false;
      pushError(errors, "shot", index, key, "Missing required field");
    }
  }

  if (!isInt(shot.id)) {
    valid = false;
    pushError(errors, "shot", index, "id", "Must be integer");
  }
  if (shot.matchId !== undefined && !isInt(shot.matchId)) {
    valid = false;
    pushError(errors, "shot", index, "matchId", "Must be integer");
  }
  if (shot.playerId !== undefined && !isInt(shot.playerId)) {
    valid = false;
    pushError(errors, "shot", index, "playerId", "Must be integer");
  }
  if (!isString(shot.player) || !shot.player.trim()) {
    valid = false;
    pushError(errors, "shot", index, "player", "Must be non-empty string");
  }
  if (shot.minute !== undefined && !isInt(shot.minute)) {
    valid = false;
    pushError(errors, "shot", index, "minute", "Must be integer");
  }
  if (!isNumber(shot.x) || shot.x < 0 || shot.x > 100) {
    valid = false;
    pushError(errors, "shot", index, "x", "Must be number between 0 and 100");
  }
  if (!isNumber(shot.y) || shot.y < 0 || shot.y > 100) {
    valid = false;
    pushError(errors, "shot", index, "y", "Must be number between 0 and 100");
  }
  if (!isNumber(shot.xG)) {
    valid = false;
    pushError(errors, "shot", index, "xG", "Must be number");
  }
  if (!isString(shot.outcome)) {
    valid = false;
    pushError(errors, "shot", index, "outcome", "Must be string");
  }

  return valid;
}

function validateCollection(items, validator, schemaName) {
  const errors = [];
  if (!Array.isArray(items)) {
    errors.push({
      schema: schemaName,
      index: -1,
      field: schemaName,
      message: "Payload must be an array"
    });
    return { valid: false, errors };
  }

  let valid = true;
  items.forEach((item, index) => {
    if (!validator(item, index, errors)) valid = false;
  });

  return { valid: valid && errors.length === 0, errors };
}

function logValidationErrors(errors) {
  if (!errors.length) return;
  console.error("[dataWriter] Validation failed with errors:");
  for (const err of errors) {
    console.error(
      `[${err.schema}] index=${err.index} field=${err.field} message=${err.message}`
    );
  }
}

async function writeCollectionOrFallback({
  filePath,
  nextData,
  existingFallback,
  validator,
  schemaName
}) {
  const { valid, errors } = validateCollection(nextData, validator, schemaName);

  if (!valid) {
    logValidationErrors(errors);
    if (existingFallback !== null) {
      await writePrettyJson(filePath, existingFallback);
      return { usedFallback: true, written: false, errors };
    }
    return { usedFallback: false, written: false, errors };
  }

  await writePrettyJson(filePath, nextData);
  return { usedFallback: false, written: true, errors: [] };
}

/**
 * Writes normalized canonical data into data/*.json.
 * On validation or API data failure, keeps last known good files.
 */
async function writeCanonicalData({
  players,
  matches,
  shots,
  dataDir = path.resolve(process.cwd(), "data")
}) {
  const playersPath = path.join(dataDir, "players.json");
  const matchesPath = path.join(dataDir, "matches.json");
  const shotsPath = path.join(dataDir, "shots.json");

  await fs.mkdir(dataDir, { recursive: true });

  const [existingPlayers, existingMatches, existingShots] = await Promise.all([
    readJsonIfExists(playersPath),
    readJsonIfExists(matchesPath),
    readJsonIfExists(shotsPath)
  ]);

  const incomingPlayers = Array.isArray(players) ? players : null;
  const incomingMatches = Array.isArray(matches) ? matches : null;
  const incomingShots = Array.isArray(shots) ? shots : null;

  const playerResult = incomingPlayers
    ? await writeCollectionOrFallback({
        filePath: playersPath,
        nextData: incomingPlayers,
        existingFallback: existingPlayers,
        validator: validatePlayer,
        schemaName: "player"
      })
    : { usedFallback: existingPlayers !== null, written: false, errors: [{ schema: "player", index: -1, field: "players", message: "Incoming players missing (API failure)" }] };

  const matchResult = incomingMatches
    ? await writeCollectionOrFallback({
        filePath: matchesPath,
        nextData: incomingMatches,
        existingFallback: existingMatches,
        validator: validateMatch,
        schemaName: "match"
      })
    : { usedFallback: existingMatches !== null, written: false, errors: [{ schema: "match", index: -1, field: "matches", message: "Incoming matches missing (API failure)" }] };

  const shotResult = incomingShots
    ? await writeCollectionOrFallback({
        filePath: shotsPath,
        nextData: incomingShots,
        existingFallback: existingShots,
        validator: validateShot,
        schemaName: "shot"
      })
    : { usedFallback: existingShots !== null, written: false, errors: [{ schema: "shot", index: -1, field: "shots", message: "Incoming shots missing (API failure)" }] };

  // Log explicit API-failure fallbacks.
  [...playerResult.errors, ...matchResult.errors, ...shotResult.errors].forEach((err) => {
    if (err.message.includes("API failure")) {
      console.error(`[dataWriter] ${err.schema}: ${err.message}`);
    }
  });

  return {
    players: playerResult,
    matches: matchResult,
    shots: shotResult
  };
}

module.exports = {
  writeCanonicalData,
  validateMatch,
  validatePlayer,
  validateShot
};

