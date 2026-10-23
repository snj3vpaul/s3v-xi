# Update 02 — Interactive points and match scoring

## Delivered

- `/points`: S3V XI batting/bowling/fielding rules and an interactive calculator for individual match figures. Includes captain, vice-captain and Skipper x3 preview multipliers.
- `/players`: Search/filter/sort and expand imported tournament aggregate player data. Four tournament IDs are represented: 1985875, 1985883, 2198428, 1985886.
- `/match-centre`: Canterbury T20 vs Kanata T20 match workspace, linked to CricHeroes match 24540875. Select from the actual 2026 uploaded player identities. Manually enter figures, download a blank CSV template, import authorized per-match figures, export entries and clear local data. Click player point rankings to expand the exact calculated breakdown. Optional entirely illustrative entries are never confused with verified scores.
- `/leaderboard`: Clickable local **individual player point ranking**, derived exclusively from saved match figures. It does not claim to be a public fantasy manager leaderboard.
- Reusable pure function `scoreMatchFigures` and CSV parsing/import validation, with unit tests.
- All four uploaded historical leaderboards are consolidated into `lib/historical-players.json`. No cumulative statistics are misrepresented as per-match scores.

## Points rules (proposed S3V XI defaults)

- Runs +1, fours +1 bonus, sixes +2 bonus.
- Run milestones: 30+ = +4, 50+ = +8, 100+ = +16. Highest only.
- Bowler-credited wickets +25, maiden overs +12.
- Catches +8, stumping +12, direct run-out +12, assisted run-out +6.
- An explicitly confirmed batter or all-rounder who is dismissed without scoring receives -2; unknown roles receive no presumed duck deduction.
- Captain 2x, vice-captain 1.5x, Skipper x3 replaces captain 2x with 3x. Full Squad is available in the separate fictional team builder, not a per-match player score calculation.

### CSV import format

```csv
player_id,runs,fours,sixes,wickets,maidens,catches,stumpings,directRunOuts,assistedRunOuts,dismissed,played
```

`player_id` must be an existing 2026 Canterbury or Kanata player ID from the supplied historical roster. All numeric fields are non-negative integers and all rows must be unique by ID. `played` and `dismissed` accept true/false or 1/0. All uploaded data is treated as unverified, even when entered from an official scorecard. It is the admin's responsibility to validate it against the linked source.

### Known limits / next production milestone

- No verified scoring feed: the CricHeroes URL is a reference link, not an API connection.
- The exact 2026 match statistics could not be retrieved reliably. No invented scorecard is seeded as real.
- Match figures persist to browser localStorage only and may differ across devices, browsers, sessions, or in private mode. There is no Supabase user account or global shared state.
- The player-points leaderboard is a single-match, single-browser ranking. Real fantasy-manager standings require saved squads, lineups, round deadlines and a server-side scoring pipeline.
- 2026 player roles were matched from uploaded MVP names/teams only where sufficiently unambiguous. Unknown roles remain unconfirmed. Teams for earlier tournament IDs are not independently verified.
- A separate production backend should implement server-side role confirmation, imports, scorecard revisions, rule versions, immutable fantasy round snapshots, admin authorization and anti-duplication checks.
