function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, incoming) {
  const out = deepClone(base);
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (!Array.isArray(out[key]) || out[key].length === 0) out[key] = deepClone(value);
      continue;
    }
    if (isObject(value)) {
      out[key] = deepMerge(isObject(out[key]) ? out[key] : {}, value);
      continue;
    }
    if (out[key] === undefined || out[key] === null || out[key] === "") {
      out[key] = value;
    }
  }
  return out;
}

function normalizeString(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeamName(team) {
  const cleaned = normalizeString(team)
    .replace(/\bfc\b/g, "")
    .replace(/\bfootball club\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const aliases = {
    arsenal: "arsenal",
    "arsenal women": "arsenal",
    "manchester city": "man city",
    "man city": "man city",
    "manchester united": "man united",
    "man united": "man united",
    "tottenham hotspur": "tottenham",
    tottenham: "tottenham"
  };

  return aliases[cleaned] || cleaned;
}

function normalizePlayerName(name) {
  return normalizeString(name)
    .replace(/\bjr\b/g, "")
    .replace(/\bii\b|\biii\b|\biv\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(str) {
  const tokens = normalizeString(str).split(" ").filter(Boolean);
  return new Set(tokens);
}

function jaccardSimilarity(a, b) {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection += 1;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union;
}

const SOURCE_PRIORITY = {
  fbref: 3,
  footballData: 2,
  fpl: 1
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sortSourcesByQuality(sourcePayloads) {
  return Object.entries(sourcePayloads).sort(
    (a, b) => (SOURCE_PRIORITY[b[0]] || 0) - (SOURCE_PRIORITY[a[0]] || 0)
  );
}

function getPlayerTeam(player) {
  return normalizeTeamName(player.club || player.team || "");
}

function buildPlayerIdentityKey(player) {
  return `${normalizePlayerName(player.name)}|${getPlayerTeam(player)}`;
}

function canBeSamePlayer(a, b) {
  const aTeam = getPlayerTeam(a);
  const bTeam = getPlayerTeam(b);
  const sameTeam = aTeam && bTeam && aTeam === bTeam;

  const aName = normalizePlayerName(a.name);
  const bName = normalizePlayerName(b.name);
  const exactName = aName && bName && aName === bName;
  const fuzzy = jaccardSimilarity(aName, bName) >= 0.75;

  // Match primarily by name + team. Fuzzy fallback still requires same team.
  if (sameTeam && (exactName || fuzzy)) return true;
  return false;
}

function sanitizePlayer(player) {
  const p = deepClone(player);
  if (!p.stats) p.stats = {};
  if (!p.radar) p.radar = {};
  if (!Array.isArray(p.form)) p.form = [];
  return p;
}

function mergeTwoPlayers(preferred, secondary) {
  const base = sanitizePlayer(preferred);
  const incoming = sanitizePlayer(secondary);
  const merged = deepMerge(base, incoming);

  // Keep higher confidence identity fields from preferred source.
  merged.id = base.id ?? incoming.id;
  merged.name = base.name || incoming.name || "";
  merged.club = base.club || incoming.club || null;
  return merged;
}

function mergePlayers(sourcePayloads) {
  const sorted = sortSourcesByQuality(sourcePayloads);
  const unified = [];

  for (const [, payload] of sorted) {
    const players = asArray(payload?.players);

    for (const player of players) {
      const clean = sanitizePlayer(player);

      // Fast exact key lookup first.
      const key = buildPlayerIdentityKey(clean);
      let existingIndex = unified.findIndex((u) => buildPlayerIdentityKey(u) === key);

      // Fuzzy fallback if exact key misses.
      if (existingIndex === -1) {
        existingIndex = unified.findIndex((u) => canBeSamePlayer(u, clean));
      }

      if (existingIndex === -1) {
        unified.push(clean);
      } else {
        unified[existingIndex] = mergeTwoPlayers(unified[existingIndex], clean);
      }
    }
  }

  // Remove accidental duplicates by final identity key.
  const dedup = new Map();
  for (const player of unified) {
    const key = buildPlayerIdentityKey(player);
    if (!dedup.has(key)) {
      dedup.set(key, player);
      continue;
    }
    dedup.set(key, mergeTwoPlayers(dedup.get(key), player));
  }

  return [...dedup.values()];
}

function normalizeMatchIdentity(match) {
  const date = String(match.date || "").slice(0, 10);
  const home = normalizeTeamName(match.homeTeam);
  const away = normalizeTeamName(match.awayTeam);
  return `${date}|${home}|${away}`;
}

function sanitizeMatch(match) {
  const m = deepClone(match);
  if (!m.stats) m.stats = {};
  return m;
}

function mergeTwoMatches(preferred, secondary) {
  const base = sanitizeMatch(preferred);
  const incoming = sanitizeMatch(secondary);
  const merged = deepMerge(base, incoming);
  merged.id = base.id ?? incoming.id;
  return merged;
}

function mergeMatches(sourcePayloads) {
  const sorted = sortSourcesByQuality(sourcePayloads);
  const byIdentity = new Map();

  for (const [, payload] of sorted) {
    const matches = asArray(payload?.matches);
    for (const match of matches) {
      const clean = sanitizeMatch(match);
      const identity = normalizeMatchIdentity(clean);
      if (!identity || identity === "||") continue;

      if (!byIdentity.has(identity)) {
        byIdentity.set(identity, clean);
      } else {
        byIdentity.set(identity, mergeTwoMatches(byIdentity.get(identity), clean));
      }
    }
  }

  return [...byIdentity.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function mergeShots(sourcePayloads) {
  const sorted = sortSourcesByQuality(sourcePayloads);
  const byIdentity = new Map();

  for (const [, payload] of sorted) {
    const shots = asArray(payload?.shots);
    for (const shot of shots) {
      const identity = [
        shot.matchId ?? "",
        normalizePlayerName(shot.player),
        shot.minute ?? "",
        shot.x ?? "",
        shot.y ?? "",
        shot.outcome ?? ""
      ].join("|");

      if (!byIdentity.has(identity)) {
        byIdentity.set(identity, deepClone(shot));
      } else {
        byIdentity.set(identity, deepMerge(byIdentity.get(identity), shot));
      }
    }
  }

  return [...byIdentity.values()];
}

function buildDefaultSeasonStats() {
  return {
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    position: 0,
    cleanSheets: 0,
    xGFor: 0,
    xGAgainst: 0,
    avgPossession: 0,
    ppda: 0,
    fieldTilt: 0,
    form: [],
    monthlyXG: []
  };
}

function mergeSeasonStats(sourcePayloads) {
  const sorted = sortSourcesByQuality(sourcePayloads);
  const merged = buildDefaultSeasonStats();

  for (const [, payload] of sorted) {
    if (!isObject(payload?.seasonStats)) continue;
    Object.assign(merged, deepMerge(merged, payload.seasonStats));
  }

  if (!Array.isArray(merged.form)) merged.form = [];
  if (!Array.isArray(merged.monthlyXG)) merged.monthlyXG = [];
  return merged;
}

function mergeProviderData(sourcePayloads) {
  const players = mergePlayers(sourcePayloads);
  const matches = mergeMatches(sourcePayloads);
  const shots = mergeShots(sourcePayloads);
  const seasonStats = mergeSeasonStats(sourcePayloads);

  return { players, matches, shots, seasonStats };
}

module.exports = {
  mergeProviderData,
  mergePlayers,
  mergeMatches,
  mergeShots,
  mergeSeasonStats,
  // Export helpers for testing.
  normalizePlayerName,
  normalizeTeamName,
  canBeSamePlayer
};

