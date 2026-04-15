# Arsenal Data Contract Redesign

This document defines the **single source of truth** for data exchanged between the ingestion pipeline and frontend UI.

## Goals

- Use one stable contract across providers, pipeline, and UI.
- Preserve current features: match list, season stats, player stats, shot maps, transfer scouting.
- Make contracts explicit to prevent shape drift and silent UI failures.

## Versioning Rules

- Every JSON file includes:
  - `schemaVersion` (semver string)
  - `generatedAt` (ISO timestamp)
  - `season` (string like `2025/26`)
  - `sourceMeta` (provider freshness and status)
- Backward-incompatible changes require a major version bump.

---

## 1) `matches.json` Contract

### TypeScript Interfaces

```ts
export interface SourceStatus {
  provider: "fpl" | "footballData" | "fbref";
  fetchedAt: string; // ISO timestamp
  ok: boolean;
  message?: string;
}

export interface SourceMeta {
  statuses: SourceStatus[];
}

export interface MatchTeamStats {
  xG?: number;
  shots?: number;
  shotsOnTarget?: number;
  possession?: number; // 0-100
  passes?: number;
  passAccuracy?: number; // 0-100
  corners?: number;
  fouls?: number;
  ppda?: number;
}

export interface MatchScorer {
  playerId?: number;
  player: string;
  minute: number;
  team: string;
}

export interface XGTimelinePoint {
  minute: number;
  cumHome: number;
  cumAway: number;
  goal?: boolean;
  team?: "home" | "away";
}

export interface KeyMoment {
  minute: number;
  type: "goal" | "card" | "substitution" | "big_chance" | "var" | "other";
  team: string;
  player?: string;
  note?: string;
}

export interface MatchRecord {
  id: number;
  externalIds?: {
    fpl?: number;
    footballData?: number;
    fbref?: string;
  };
  date: string; // YYYY-MM-DD
  kickoffUtc?: string; // ISO timestamp
  competition: string;
  matchweek: number;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  resultFromArsenalView: "W" | "D" | "L";
  attendance?: number;
  stats: {
    home?: MatchTeamStats;
    away?: MatchTeamStats;
  };
  scorers: MatchScorer[];
  assists: MatchScorer[];
  xgTimeline: XGTimelinePoint[];
  keyMoments: KeyMoment[];
}

export interface MonthlyXG {
  month: string; // e.g. "Aug"
  xGFor: number;
  xGAgainst: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface SeasonStatistics {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  position: number;
  cleanSheets: number;
  xGFor: number;
  xGAgainst: number;
  avgPossession: number;
  ppda: number;
  fieldTilt: number;
  form: ("W" | "D" | "L")[];
  monthlyXG: MonthlyXG[];
}

export interface MatchesFile {
  schemaVersion: "2.0.0";
  generatedAt: string; // ISO timestamp
  season: string; // "2025/26"
  sourceMeta: SourceMeta;
  seasonStats: SeasonStatistics;
  matches: MatchRecord[];
}
```

### Example `matches.json`

```json
{
  "schemaVersion": "2.0.0",
  "generatedAt": "2026-04-14T09:00:00.000Z",
  "season": "2025/26",
  "sourceMeta": {
    "statuses": [
      { "provider": "fpl", "fetchedAt": "2026-04-14T08:59:30.000Z", "ok": true },
      { "provider": "footballData", "fetchedAt": "2026-04-14T08:59:40.000Z", "ok": true },
      { "provider": "fbref", "fetchedAt": "2026-04-14T08:59:50.000Z", "ok": false, "message": "rate limited" }
    ]
  },
  "seasonStats": {
    "played": 32,
    "won": 22,
    "drawn": 7,
    "lost": 3,
    "goalsFor": 68,
    "goalsAgainst": 26,
    "points": 73,
    "position": 2,
    "cleanSheets": 13,
    "xGFor": 63.4,
    "xGAgainst": 28.7,
    "avgPossession": 59.2,
    "ppda": 9.8,
    "fieldTilt": 61.3,
    "form": ["W", "W", "D", "W", "L"],
    "monthlyXG": [
      { "month": "Jan", "xGFor": 8.4, "xGAgainst": 3.1, "goalsFor": 9, "goalsAgainst": 3 },
      { "month": "Feb", "xGFor": 7.9, "xGAgainst": 4.0, "goalsFor": 8, "goalsAgainst": 4 }
    ]
  },
  "matches": [
    {
      "id": 538097,
      "externalIds": { "footballData": 538097, "fpl": 311 },
      "date": "2026-04-11",
      "kickoffUtc": "2026-04-11T15:30:00.000Z",
      "competition": "Premier League",
      "matchweek": 32,
      "venue": "Emirates Stadium",
      "homeTeam": "Arsenal",
      "awayTeam": "Bournemouth",
      "homeScore": 1,
      "awayScore": 2,
      "resultFromArsenalView": "L",
      "attendance": 60213,
      "stats": {
        "home": { "xG": 1.7, "shots": 15, "shotsOnTarget": 6, "possession": 62, "passes": 612, "passAccuracy": 89, "corners": 7, "fouls": 8, "ppda": 10.1 },
        "away": { "xG": 1.9, "shots": 11, "shotsOnTarget": 5, "possession": 38, "passes": 382, "passAccuracy": 82, "corners": 4, "fouls": 11, "ppda": 16.8 }
      },
      "scorers": [
        { "playerId": 1, "player": "Bukayo Saka", "minute": 51, "team": "Arsenal" }
      ],
      "assists": [],
      "xgTimeline": [
        { "minute": 12, "cumHome": 0.24, "cumAway": 0.05 },
        { "minute": 51, "cumHome": 0.98, "cumAway": 0.32, "goal": true, "team": "home" }
      ],
      "keyMoments": [
        { "minute": 51, "type": "goal", "team": "Arsenal", "player": "Bukayo Saka" }
      ]
    }
  ]
}
```

---

## 2) `players.json` Contract

### TypeScript Interfaces

```ts
export interface PlayerStats {
  appearances: number;
  goals: number;
  assists: number;
  xG: number;
  xA: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  progressivePasses: number;
  progressiveCarries: number;
  dribbles: number;
  dribbleSuccess: number;
  aerialWon: number;
  aerialLost: number;
  tackles: number;
  interceptions: number;
  minutesPlayed: number;
  touches: number;
  passAccuracy: number;
  pressures: number;
  pressureSuccess: number;
}

export interface RadarProfile {
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  vision: number;
}

export interface PlayerRecord {
  id: number;
  externalIds?: {
    fpl?: number;
    footballData?: number;
    fbref?: string;
  };
  name: string;
  position: string;
  number: number | null;
  nationality: string;
  age: number | null;
  image: string | null;
  club: string;
  marketValue: number | null; // millions EUR
  stats: PlayerStats;
  radar: RadarProfile;
  form: number[]; // 1 win, 0 draw, -1 loss
}

export interface PlayersFile {
  schemaVersion: "2.0.0";
  generatedAt: string;
  season: string;
  sourceMeta: SourceMeta;
  players: PlayerRecord[];
}
```

### Example `players.json`

```json
{
  "schemaVersion": "2.0.0",
  "generatedAt": "2026-04-14T09:00:00.000Z",
  "season": "2025/26",
  "sourceMeta": {
    "statuses": [
      { "provider": "fpl", "fetchedAt": "2026-04-14T08:59:30.000Z", "ok": true },
      { "provider": "footballData", "fetchedAt": "2026-04-14T08:59:40.000Z", "ok": true },
      { "provider": "fbref", "fetchedAt": "2026-04-14T08:59:50.000Z", "ok": true }
    ]
  },
  "players": [
    {
      "id": 1,
      "externalIds": { "fpl": 19, "footballData": 1877, "fbref": "saka-bukayo" },
      "name": "Bukayo Saka",
      "position": "RW",
      "number": 7,
      "nationality": "England",
      "age": 23,
      "image": "https://example.com/saka.png",
      "club": "Arsenal",
      "marketValue": 120,
      "stats": {
        "appearances": 32,
        "goals": 14,
        "assists": 11,
        "xG": 12.8,
        "xA": 9.4,
        "shots": 87,
        "shotsOnTarget": 41,
        "keyPasses": 68,
        "progressivePasses": 142,
        "progressiveCarries": 198,
        "dribbles": 72,
        "dribbleSuccess": 58,
        "aerialWon": 12,
        "aerialLost": 28,
        "tackles": 34,
        "interceptions": 18,
        "minutesPlayed": 2760,
        "touches": 1842,
        "passAccuracy": 84.2,
        "pressures": 312,
        "pressureSuccess": 28
      },
      "radar": {
        "shooting": 78,
        "passing": 82,
        "dribbling": 86,
        "defending": 52,
        "physical": 71,
        "vision": 80
      },
      "form": [1, 1, 0, 1, -1]
    }
  ]
}
```

---

## 3) `shots.json` Contract

### TypeScript Interfaces

```ts
export interface ShotEvent {
  id: number;
  matchId: number;
  playerId?: number;
  player: string;
  team: string;
  minute: number;
  x: number; // 0-100
  y: number; // 0-100
  xG: number;
  outcome: "Goal" | "Saved" | "Blocked" | "Off Target" | "Woodwork";
  bodyPart?: "Right Foot" | "Left Foot" | "Head" | "Other";
  playType?: "Open Play" | "Set Piece" | "Penalty" | "Counter" | "Other";
  period?: 1 | 2 | 3 | 4;
}

export interface PlayerShotSummary {
  playerId: number;
  player: string;
  shots: number;
  goals: number;
  totalXG: number;
  avgXGPerShot: number;
}

export interface MatchShotSummary {
  matchId: number;
  totalShots: number;
  totalGoals: number;
  totalXG: number;
}

export interface TransferScoutingEntry {
  id: number;
  name: string;
  position: string;
  age: number;
  club: string;
  nationality: string;
  marketValue: number; // millions EUR
  contractUntil?: string;
  stats: {
    goals: number;
    assists: number;
    xG: number;
    xA: number;
    shots: number;
    keyPasses: number;
    dribbles: number;
    progressivePasses: number;
    progressiveCarries: number;
    minutesPlayed: number;
  };
  radar: RadarProfile;
  scouting: {
    strengths: string[];
    concerns: string[];
    fitScore: number; // 0-100
    verdict: string;
    tag?: string;
  };
}

export interface ShotsFile {
  schemaVersion: "2.0.0";
  generatedAt: string;
  season: string;
  sourceMeta: SourceMeta;
  shots: ShotEvent[];
  playerShotSummary: PlayerShotSummary[];
  matchShotSummary: MatchShotSummary[];
  transferTargets: TransferScoutingEntry[];
}
```

### Example `shots.json`

```json
{
  "schemaVersion": "2.0.0",
  "generatedAt": "2026-04-14T09:00:00.000Z",
  "season": "2025/26",
  "sourceMeta": {
    "statuses": [
      { "provider": "fpl", "fetchedAt": "2026-04-14T08:59:30.000Z", "ok": true },
      { "provider": "footballData", "fetchedAt": "2026-04-14T08:59:40.000Z", "ok": true },
      { "provider": "fbref", "fetchedAt": "2026-04-14T08:59:50.000Z", "ok": true }
    ]
  },
  "shots": [
    {
      "id": 900001,
      "matchId": 538097,
      "playerId": 1,
      "player": "Bukayo Saka",
      "team": "Arsenal",
      "minute": 51,
      "x": 88.5,
      "y": 47.2,
      "xG": 0.24,
      "outcome": "Goal",
      "bodyPart": "Left Foot",
      "playType": "Open Play",
      "period": 2
    }
  ],
  "playerShotSummary": [
    {
      "playerId": 1,
      "player": "Bukayo Saka",
      "shots": 87,
      "goals": 14,
      "totalXG": 12.8,
      "avgXGPerShot": 0.147
    }
  ],
  "matchShotSummary": [
    {
      "matchId": 538097,
      "totalShots": 26,
      "totalGoals": 3,
      "totalXG": 3.6
    }
  ],
  "transferTargets": [
    {
      "id": 101,
      "name": "Florian Wirtz",
      "position": "CAM",
      "age": 22,
      "club": "Bayer Leverkusen",
      "nationality": "Germany",
      "marketValue": 120,
      "contractUntil": "2028-06-30",
      "stats": {
        "goals": 12,
        "assists": 14,
        "xG": 9.8,
        "xA": 11.2,
        "shots": 73,
        "keyPasses": 89,
        "dribbles": 96,
        "progressivePasses": 165,
        "progressiveCarries": 173,
        "minutesPlayed": 2870
      },
      "radar": {
        "shooting": 79,
        "passing": 92,
        "dribbling": 90,
        "defending": 48,
        "physical": 67,
        "vision": 94
      },
      "scouting": {
        "strengths": ["Elite final-third passing", "Press-resistant in central zones"],
        "concerns": ["High transfer fee", "Role overlap risk"],
        "fitScore": 91,
        "verdict": "Top-tier creative profile for Arsenal's left half-space.",
        "tag": "Priority Target"
      }
    }
  ]
}
```

---

## Frontend Access Pattern (Required)

Use the following **canonical access paths**:

- `matches.json`
  - Match list: `matchesData.matches`
  - Season dashboard: `matchesData.seasonStats`
  - Timeline and per-match detail: `matchesData.matches[i].xgTimeline`, `matchesData.matches[i].stats`
- `players.json`
  - Player cards/list: `playersData.players`
  - Player detail: `playersData.players.find(p => p.id === id)`
- `shots.json`
  - Raw shot map events: `shotsData.shots`
  - Filter by player: `shotsData.shots.filter(s => s.playerId === id)`
  - Filter by match: `shotsData.shots.filter(s => s.matchId === id)`
  - Scouting list: `shotsData.transferTargets`

## Frontend Contract Rules

- Always gate by `schemaVersion` before render.
- Do not assume provider-specific IDs are primary keys.
- Use `id` as canonical internal key.
- Do not read undocumented fields.
- Fail loudly in dev when required keys are missing.

## Migration Notes

- Replace any UI usage of top-level array assumptions for `matches.json` and `shots.json`.
- Replace legacy nested shot keys like `shots.player_saka.shots` with filtered `shotsData.shots`.
- Keep transfer scouting in `shots.json` under `transferTargets` to support transfer-radar without extra file fetches.

