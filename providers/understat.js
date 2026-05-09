const { toNumber, toInt, normalizeTeamLabel, sleep } = require("../core/utils");

const BASE_URL = "https://understat.com";
// XMLHttpRequest header is required — Understat's jQuery AJAX endpoint rejects plain fetches
const AJAX_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; ArsenalAnalytics/1.0; data aggregation)",
  "X-Requested-With": "XMLHttpRequest",
  "Referer": `${BASE_URL}/team/Arsenal/2025`,
  "Accept": "application/json, text/javascript, */*; q=0.01"
};

const ARSENAL_UNDERSTAT_NAME = "Arsenal";
const MATCH_DETAIL_LIMIT = 12;

function mapOutcome(resultRaw) {
  const r = String(resultRaw || "").toLowerCase().replace(/\s/g, "");
  if (r === "goal") return "Goal";
  if (r === "savedshot") return "Saved";
  if (r === "missedshots" || r === "miss") return "Off Target";
  if (r === "blockedshot") return "Blocked";
  if (r === "shotonpost") return "Post";
  return resultRaw || "Unknown";
}

function mapBodyPart(raw) {
  const r = String(raw || "").toLowerCase();
  if (r.includes("head")) return "Head";
  if (r.includes("foot")) return "Foot";
  return raw || undefined;
}

function mapSituation(raw) {
  const r = String(raw || "").toLowerCase().replace(/\s/g, "");
  if (r === "openplay") return "Open Play";
  if (r === "setpiece") return "Set Piece";
  if (r === "directfreekick" || r === "fromfreekick") return "Free Kick";
  if (r === "fromcorner") return "Corner";
  if (r === "penalty") return "Penalty";
  return raw || undefined;
}

function normalizeShotEvent(shot, numericMatchId, shotIndex) {
  // Understat x, y are 0–1 scale; we convert to 0–100
  const xRaw = toNumber(shot.X ?? shot.x);
  const yRaw = toNumber(shot.Y ?? shot.y);
  const isHome = String(shot.h_a || "").toLowerCase() === "h";
  const teamName = normalizeTeamLabel(isHome ? (shot.h_team || "") : (shot.a_team || ""));

  return {
    id: numericMatchId * 1000 + shotIndex,
    matchId: numericMatchId,
    playerId: shot.player_id ? toInt(shot.player_id) : undefined,
    player: shot.player || "",
    team: teamName,
    minute: toInt(shot.minute ?? shot.min),
    x: Number((xRaw * 100).toFixed(1)),
    y: Number((yRaw * 100).toFixed(1)),
    xG: toNumber(shot.xG),
    outcome: mapOutcome(shot.result),
    bodyPart: mapBodyPart(shot.shotType),
    playType: mapSituation(shot.situation),
    period: shot.period || undefined
  };
}

function buildXGTimeline(homeShots, awayShots, numericMatchId) {
  const allShots = [
    ...homeShots.map((s) => ({ ...s, isHome: true })),
    ...awayShots.map((s) => ({ ...s, isHome: false }))
  ].sort((a, b) => toInt(a.minute ?? a.min) - toInt(b.minute ?? b.min));

  if (allShots.length === 0) return [];

  let cumHome = 0;
  let cumAway = 0;
  const timeline = [{ minute: 0, cumHome: 0, cumAway: 0 }];

  for (const shot of allShots) {
    const minute = toInt(shot.minute ?? shot.min);
    const xg = toNumber(shot.xG);
    const isGoal = String(shot.result || "").toLowerCase() === "goal";
    const teamLabel = normalizeTeamLabel(shot.isHome ? (shot.h_team || "") : (shot.a_team || ""));

    if (shot.isHome) cumHome += xg;
    else cumAway += xg;

    timeline.push({
      minute,
      cumHome: Number(cumHome.toFixed(2)),
      cumAway: Number(cumAway.toFixed(2)),
      ...(isGoal ? { goal: true, team: teamLabel } : {})
    });
  }

  return timeline;
}

async function fetchJson(url) {
  const referer = url.includes("getMatchData")
    ? `${BASE_URL}/match/${url.split("/").pop()}`
    : `${BASE_URL}/team/Arsenal/2025`;

  const response = await fetch(url, {
    headers: { ...AJAX_HEADERS, Referer: referer }
  });

  if (!response.ok) {
    throw new Error(`Understat request failed: ${response.status} ${response.statusText} (${url})`);
  }
  return response.json();
}

async function fetchUnderstatData(options = {}) {
  const season = options.season ?? 2025;
  const teamName = options.teamName ?? ARSENAL_UNDERSTAT_NAME;
  const matchDetailLimit = options.matchDetailLimit ?? MATCH_DETAIL_LIMIT;

  console.log(`[understat] fetching team data for ${teamName} ${season}...`);

  const teamData = await fetchJson(`${BASE_URL}/getTeamData/${encodeURIComponent(teamName)}/${season}`);

  const allDates = Array.isArray(teamData.dates) ? teamData.dates : [];
  const finishedMatches = allDates.filter(
    (m) => m.isResult === true || m.isResult === "true" || m.isResult === 1
  );

  console.log(`[understat] found ${finishedMatches.length} finished matches.`);

  // Build matchXG map keyed by date (YYYY-MM-DD)
  const matchXG = {};
  for (const m of finishedMatches) {
    const date = String(m.datetime || "").slice(0, 10);
    if (!date) continue;

    const homeTeam = normalizeTeamLabel(m.h?.title || "");
    const awayTeam = normalizeTeamLabel(m.a?.title || "");
    const xGHome = toNumber(m.xG?.h);
    const xGAway = toNumber(m.xG?.a);

    if (!matchXG[date]) matchXG[date] = [];
    matchXG[date].push({
      understatId: m.id,
      homeTeam,
      awayTeam,
      xGHome: Number(xGHome.toFixed(2)),
      xGAway: Number(xGAway.toFixed(2))
    });
  }

  // Fetch shot details for the N most recent finished matches
  const recentMatches = finishedMatches
    .slice()
    .sort((a, b) => String(b.datetime || "").localeCompare(String(a.datetime || "")))
    .slice(0, matchDetailLimit);

  const allShots = [];
  const xgTimelines = {};

  for (const matchMeta of recentMatches) {
    const understatId = matchMeta.id;
    if (!understatId) continue;

    const numericId = toInt(understatId);

    try {
      await sleep(700);
      console.log(`[understat] fetching shots for match ${understatId}...`);

      const matchData = await fetchJson(`${BASE_URL}/getMatchData/${understatId}`);

      const shotsObj = matchData.shots || matchData.shotsData || {};
      const homeShots = Array.isArray(shotsObj.h) ? shotsObj.h : [];
      const awayShots = Array.isArray(shotsObj.a) ? shotsObj.a : [];

      homeShots.forEach((shot, i) => {
        const normalized = normalizeShotEvent(shot, numericId, i);
        if (normalized.player && normalized.x >= 0 && normalized.y >= 0) {
          allShots.push(normalized);
        }
      });

      awayShots.forEach((shot, i) => {
        const normalized = normalizeShotEvent(shot, numericId, homeShots.length + i);
        if (normalized.player && normalized.x >= 0 && normalized.y >= 0) {
          allShots.push(normalized);
        }
      });

      const timeline = buildXGTimeline(homeShots, awayShots, numericId);
      if (timeline.length > 1) {
        xgTimelines[numericId] = timeline;
      }
    } catch (err) {
      console.warn(`[understat] match ${understatId} unavailable: ${err.message}`);
    }
  }

  console.log(`[understat] done. ${allShots.length} shots, ${Object.keys(xgTimelines).length} xG timelines.`);

  return {
    players: [],
    matches: [],
    shots: allShots,
    seasonStats: null,
    matchXG,
    xgTimelines
  };
}

module.exports = { fetchUnderstatData };
