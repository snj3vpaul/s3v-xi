# Data model

Schema version 2. Version-1 documents are upgraded automatically on read (`migrate` in `lib/league/ledger.ts`).

The whole league is one JSON document (`LeagueState`, defined in `lib/league/types.ts`). It's stored under a single key in Upstash Redis (Vercel KV), or in `.data/rsfc-league.json` locally.

Nothing derived is stored. Standings, form, charts and pick-7 results are recomputed from scorecards on every read. That's why editing an old match automatically recalculates everything that depends on it.

```
config/club.ts        ROSTER: Player { id, name, kind: "member" | "dropin" }   ← single source of truth

LeagueState
├─ schemaVersion: 1
├─ version            optimistic-concurrency counter
├─ settings           LeagueSettings
│    deflectionDefault: "own_goal" | "goal"
│    secondAssistEnabled, excludeDropInsFromAwards, correctionWindowDays
│    defaultConstraints: DrawConstraints
├─ users[]            User
│    id, email (lower-case), name, passwordHash ("scrypt$salt$hash"), playerId | null,
│    emailReminders, sessionVersion, createdAt
│    squadHistory[]   { picks[7], at }   ← every change; a match uses the latest one before its deadline
├─ seriesCreated[]    weekly series ids already generated (config/schedule.ts)
├─ matchDays[]        MatchDay
│    id, date, kickoffAt (UTC; also the Pick 7 deadline), seriesId?, label?,
│    status: "open" | "drawn" | "played", createdAt, reminders[] { userId, slot, at }
│    attendees[]      player ids (members and drop-ins)
│    selections[]     Selection { selectorId (user id), picks[7], submittedAt }, snapshotted at the draw
│    draw             DrawResult | null
│        algorithm, seed (256-bit hex), attempt, constraints, attendees, floaterCounts,
│        previousTeams, teamA[], teamB[], floater, floaterFirstHalf, perSide, rollingSubs, drawnAt
│    events[]         GoalEvent (the scorecard, in order)
│        id, side: "A" | "B" (team credited on the scoreboard)
│        kind: open_play | header | penalty | free_kick | own_goal | deflection
│        scorerId, assistId?, secondAssistId?, deflectedById?, deflectionRuling?, minute?, note?
│    scorecardAt      first publish time (starts the correction window)
│    scorecardVersion bumped on every correction
└─ audit[]            AuditEntry { id, at, actor, action, matchId?, reason?, before?, after? }
```

## Status flow

1. A match day starts as `open`. Attendance is editable, and accounts can still change their standing seven.
2. The admin draws the teams and it becomes `drawn`. Attendance locks. Every account's seven, as it stood at the deadline, is copied into `selections`.
3. The scorecard is published and it becomes `played`. From here, corrections are allowed until the window closes.

A draw can be reset, with a logged reason, only before a scorecard exists.

## Audit

Every transition in `lib/league/ledger.ts` appends an audit entry.

- Corrections store the full previous scorecard in `before`.
- Draw resets store the discarded draw.

Nothing is overwritten silently.

## Size

The stored JSON is about 10 KB per match day, measured on the demo season with 16–19 players and 8–13 pick-7 entries per match. Most of that is audit entries. A 40-match-day season is roughly 400 KB, which stays under a 1 MB request limit.

At the end of each season:

1. Export the league from Admin.
2. Set a new `RSFC_STORAGE_KEY` (for example `rsfc:league:2027`).
3. Keep the old season's export as its archive.
