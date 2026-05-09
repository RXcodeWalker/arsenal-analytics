function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isUnknownLike(value) {
  if (value === undefined || value === null) return true;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "unknown" || normalized === "n/a" || normalized === "na";
}

function hasMeaningfulValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return !isUnknownLike(value);
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return true;
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
    if (!hasMeaningfulValue(out[key]) && hasMeaningfulValue(value)) {
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
    .replace(/\bafc\b/g, "")
    .replace(/\bfc\b/g, "")
    .replace(/\bfootball club\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const aliases = {
    arsenal: "arsenal",
    "arsenal women": "arsenal",
    "afc bournemouth": "bournemouth",
    bournemouth: "bournemouth",
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
  apiFootball: 4,
  fbref: 3,
  footballData: 2,
  understat: 2,
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
  if (!hasMeaningfulValue(p.nationality)) p.nationality = "N/A";
  if (!hasMeaningfulValue(p.position)) p.position = "UNK";
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
  if (!Array.isArray(m.xgTimeline)) m.xgTimeline = [];
  if (!Array.isArray(m.keyMoments)) m.keyMoments = [];
  if (!Array.isArray(m.scorers)) m.scorers = [];
  if (!Array.isArray(m.assists)) m.assists = [];
  return m;
}

function matchCompletenessScore(match) {
  const m = sanitizeMatch(match);
  let score = 0;
  if (hasMeaningfulValue(m.homeTeam) && hasMeaningfulValue(m.awayTeam)) score += 1;
  if (isObject(m.stats.home) && isObject(m.stats.away)) score += 3;
  if (Array.isArray(m.xgTimeline) && m.xgTimeline.length > 0) score += 2;
  if (Array.isArray(m.keyMoments) && m.keyMoments.length > 0) score += 2;
  if (Array.isArray(m.scorers) && m.scorers.length > 0) score += 1;
  if (Array.isArray(m.assists) && m.assists.length > 0) score += 1;
  if (m.attendance !== undefined && m.attendance !== null) score += 1;
  return score;
}

function mergeTwoMatches(preferred, secondary) {
  const preferredScore = matchCompletenessScore(preferred);
  const secondaryScore = matchCompletenessScore(secondary);
  const base = sanitizeMatch(preferredScore >= secondaryScore ? preferred : secondary);
  const incoming = sanitizeMatch(preferredScore >= secondaryScore ? secondary : preferred);
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

function monthLabelFromDate(dateStr) {
  const date = new Date(`${String(dateStr || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

function deriveSeasonStatsFromMatches(matches) {
  const targetTeam = "arsenal";
  const sorted = asArray(matches).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let played = 0;
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let xGFor = 0;
  let xGAgainst = 0;
  let xgForCount = 0;
  let xgAgainstCount = 0;
  let possTotal = 0;
  let possCount = 0;
  let ppdaTotal = 0;
  let ppdaCount = 0;
  const form = [];
  const monthly = new Map();

  for (const match of sorted) {
    const home = normalizeTeamName(match.homeTeam);
    const away = normalizeTeamName(match.awayTeam);
    const isHome = home === targetTeam;
    const isAway = away === targetTeam;
    if (!isHome && !isAway) continue;

    const gf = isHome ? toNumber(match.homeScore) : toNumber(match.awayScore);
    const ga = isHome ? toNumber(match.awayScore) : toNumber(match.homeScore);
    played += 1;
    goalsFor += gf;
    goalsAgainst += ga;
    if (ga === 0) cleanSheets += 1;

    const result = match.resultFromArsenalView || (gf > ga ? "W" : gf < ga ? "L" : "D");
    if (result === "W") won += 1;
    else if (result === "D") drawn += 1;
    else lost += 1;
    form.push(result);

    const homeStats = isObject(match.stats?.home) ? match.stats.home : null;
    const awayStats = isObject(match.stats?.away) ? match.stats.away : null;
    const arsStats = isHome ? homeStats : awayStats;
    const oppStats = isHome ? awayStats : homeStats;

    if (Number.isFinite(Number(arsStats?.xG))) {
      xGFor += Number(arsStats.xG);
      xgForCount += 1;
    }
    if (Number.isFinite(Number(oppStats?.xG))) {
      xGAgainst += Number(oppStats.xG);
      xgAgainstCount += 1;
    }
    if (Number.isFinite(Number(arsStats?.possession))) {
      possTotal += Number(arsStats.possession);
      possCount += 1;
    }
    if (Number.isFinite(Number(arsStats?.ppda))) {
      ppdaTotal += Number(arsStats.ppda);
      ppdaCount += 1;
    }

    const month = monthLabelFromDate(match.date);
    if (!month) continue;
    if (!monthly.has(month)) {
      monthly.set(month, {
        month,
        xGFor: 0,
        xGAgainst: 0,
        goalsFor: 0,
        goalsAgainst: 0
      });
    }
    const row = monthly.get(month);
    row.goalsFor += gf;
    row.goalsAgainst += ga;
    if (Number.isFinite(Number(arsStats?.xG))) row.xGFor += Number(arsStats.xG);
    if (Number.isFinite(Number(oppStats?.xG))) row.xGAgainst += Number(oppStats.xG);
  }

  const points = won * 3 + drawn;
  const monthlyXG = [...monthly.values()].map((row) => ({
    ...row,
    xGFor: Number(row.xGFor.toFixed(2)),
    xGAgainst: Number(row.xGAgainst.toFixed(2))
  }));

  return {
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    points,
    position: 0,
    cleanSheets,
    xGFor: Number((xgForCount > 0 ? xGFor : 0).toFixed(2)),
    xGAgainst: Number((xgAgainstCount > 0 ? xGAgainst : 0).toFixed(2)),
    avgPossession: Number((possCount > 0 ? possTotal / possCount : 0).toFixed(2)),
    ppda: Number((ppdaCount > 0 ? ppdaTotal / ppdaCount : 0).toFixed(2)),
    fieldTilt: 0,
    form,
    monthlyXG
  };
}

function mergeSeasonStats(sourcePayloads, matches) {
  const sorted = sortSourcesByQuality(sourcePayloads);
  const merged = buildDefaultSeasonStats();
  const seenAny = new Set();
  const seenNonZero = new Set();
  const numericFields = [
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

  for (const [, payload] of sorted) {
    if (!isObject(payload?.seasonStats)) continue;
    const incoming = payload.seasonStats;

    for (const field of numericFields) {
      const n = Number(incoming[field]);
      if (!Number.isFinite(n)) continue;

      if (!seenAny.has(field)) {
        merged[field] = n;
        seenAny.add(field);
        if (n !== 0) seenNonZero.add(field);
        continue;
      }

      if (!seenNonZero.has(field) && n !== 0) {
        merged[field] = n;
        seenNonZero.add(field);
      }
    }

    if (Array.isArray(incoming.form) && incoming.form.length > 0 && merged.form.length === 0) {
      merged.form = deepClone(incoming.form);
    }
    if (
      Array.isArray(incoming.monthlyXG) &&
      incoming.monthlyXG.length > 0 &&
      merged.monthlyXG.length === 0
    ) {
      merged.monthlyXG = deepClone(incoming.monthlyXG);
    }
  }

  const derived = deriveSeasonStatsFromMatches(matches);
  for (const field of numericFields) {
    if (Number(merged[field]) === 0 && Number(derived[field]) !== 0) {
      merged[field] = derived[field];
    }
  }
  if (merged.form.length === 0 && derived.form.length > 0) {
    merged.form = derived.form;
  }
  if (merged.monthlyXG.length === 0 && derived.monthlyXG.length > 0) {
    merged.monthlyXG = derived.monthlyXG;
  }

  if (!Array.isArray(merged.form)) merged.form = [];
  if (!Array.isArray(merged.monthlyXG)) merged.monthlyXG = [];
  return merged;
}

function applyUnderstatEnrichment(matches, understatPayload) {
  if (!understatPayload) return matches;

  const { matchXG, xgTimelines } = understatPayload;

  return matches.map((match) => {
    const enriched = deepClone(match);

    // Apply per-match xG values from Understat's team endpoint (1 request), keyed by date
    if (matchXG && enriched.date) {
      const candidates = matchXG[enriched.date] || [];
      for (const candidate of candidates) {
        const home = normalizeTeamName(enriched.homeTeam);
        const away = normalizeTeamName(enriched.awayTeam);
        const candHome = normalizeTeamName(candidate.homeTeam);
        const candAway = normalizeTeamName(candidate.awayTeam);
        const isMatch = (home === candHome && away === candAway) ||
          (jaccardSimilarity(home, candHome) > 0.6 && jaccardSimilarity(away, candAway) > 0.6);

        if (!isMatch) continue;

        if (!enriched.externalIds) enriched.externalIds = {};
        const numericUnderstatId = candidate.understatId ? toNumber(candidate.understatId) : null;
        if (numericUnderstatId) enriched.externalIds.understat = numericUnderstatId;

        if (!isObject(enriched.stats.home)) enriched.stats.home = {};
        if (!isObject(enriched.stats.away)) enriched.stats.away = {};

        if (!Number.isFinite(Number(enriched.stats.home.xG)) || enriched.stats.home.xG === 0) {
          enriched.stats.home.xG = candidate.xGHome;
        }
        if (!Number.isFinite(Number(enriched.stats.away.xG)) || enriched.stats.away.xG === 0) {
          enriched.stats.away.xG = candidate.xGAway;
        }

        if (numericUnderstatId && xgTimelines?.[numericUnderstatId] && enriched.xgTimeline.length === 0) {
          enriched.xgTimeline = xgTimelines[numericUnderstatId];
        }

        break;
      }
    }

    return enriched;
  });
}

function mergeProviderData(sourcePayloads) {
  const players = mergePlayers(sourcePayloads);
  let matches = mergeMatches(sourcePayloads);
  const shots = mergeShots(sourcePayloads);

  // Apply Understat xG enrichment after merging so timelines and xG values land on correct matches
  if (sourcePayloads.understat) {
    matches = applyUnderstatEnrichment(matches, sourcePayloads.understat);
  }

  const seasonStats = mergeSeasonStats(sourcePayloads, matches);

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
