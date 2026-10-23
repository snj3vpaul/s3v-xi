# S3V XI — Evidence-based product audit, 23 October 2026

## Scope and identity

The pasted implementation brief referred to a Canterbury Cricket Club fantasy application. GitHub inspection found `snj3vpaul/CanterburyCricket` (the CCC site) and `snj3vpaul/s3v-xi` (the existing fantasy application). This update targets **S3V XI**, which contains the actual match scoring and fantasy squad code. CCC's separate site and existing user records were not modified.

Repository basis: the `main` branch of S3V XI, containing routes `/`, `/players`, `/match-centre`, `/leaderboard`, and `/points`, and local copies of the previous Update 02 files. This was a **static source audit**. Browser usability, production deployment and database security were not tested. Scores are evaluative, not measured performance statistics.

## Baseline audit

| Dimension | Score (0–10) | Evidence and concern |
| --- | ---: | --- |
| Visual design | 7 | Deliberate sports typography and palette; several sections still rely on tightly packed cards and large headlines. |
| User experience | 5 | Multiple useful routes; fantasy manager journey is not end-to-end. |
| Player selection | 4 | 15-player UI and role validation exist; full XI/bench prevented straightforward swapping, draft was not saved. |
| Fantasy mechanics | 5 | Captain, vice-captain and two demo chip choices exist; transfers, deadlines and confirmed rounds are absent. |
| Data accuracy | 5 | Historical aggregate files are distinguished from per-match data; editable match figures are unverified local entries. |
| Player analytics | 5 | Historical player archive exists; no same-page comparison or match-history insights. |
| Engagement | 3 | No real private manager league, standings history, deadlines or recurring competition. |
| Mobile | 6 | CSS breakpoints and responsive tables exist; no live-device testing has been done. |
| Accessibility | 5 | Mostly labeled inputs; interactive lists and feedback need keyboard/screen-reader validation. |
| Engineering | 5 | Typed scoring/validation tests and CSV parser; no shared persistence or trusted server operations; scoring version not surfaced. |

**Baseline score: 50/100**, equal weighting across ten dimensions. Not an independently user-tested score. **Weakest areas:** engagement, selection completion and competition integrity. The last is the primary P0 release blocker despite a stronger-looking interface.

## Benchmark matrix (verified examples, not visual copies)

| Capability | S3V XI on inspected main | Dream11 | FPL 2026/27 | ESPN Fantasy | Recommended response |
| --- | --- | --- | --- | --- | --- |
| Player selection | Fictional 15-player selection; cannot publish | Role categories, captains, player points | 15-player squad, starting XI/bench, captaincy | Roster configuration, draft/lineup formats | Keep no-price selection; fix swaps and restore drafts; add server submissions later |
| Captaincy | 2x / 1.5x in demo | 2x / 1.5x | Captaincy and Triple Captain | Scoring depends on configured sport/league | Preserve, test, publish rules |
| Chip strategy | Full Squad, Skipper x3 demo | Not copied | Bench Boost, Triple Captain, Free Hit, Wildcard | Not equivalent | Single use per short tournament, no purchases; actual redemption deferred |
| Match scoring | Pure T20 calculator, local manual/CSV input | Detailed event-level cricket scoring | Event/fixture-based football scoring | Configurable scoring per league | Version rules, provenance, authoritative import, correction audit |
| Player statistics | Historical tournament aggregates | Player performance indicators | Form and fixture information | Player analysis and scoring | Compare actual aggregate records, never infer per-match fantasy points |
| Standings | Local player performance ordering only | Contest fantasy rankings | League and gameweek rankings | League standings | Shared fantasy-manager rankings need auth + persisted snapshots |
| Transfers | Not implemented | Contest-specific roster mechanics | Transfers and chip-modified rounds | Configured drafts, trades/waivers | Implement round-based, server-enforced transfer rules when schedules exist |
| Commissioner | No admin backend | Contest administration is platform managed | FPL rules platform managed | League Manager rules, roster and scoring controls with transaction logs | Secure admin panel, rule versioning, import approval, audit records |

References (official):
- Dream11 cricket scoring: https://www.dream11.com/fantasy-cricket/point-system
- FPL chips (July 20, 2026): https://www.premierleague.com/en/news/4679879/whats-happening-with-fpl-chips-in-202627
- ESPN scoring settings (July 15, 2026): https://support.espn.com/hc/en-us/articles/360000069512-Scoring-Settings
- ESPN commissioner powers (June 2026): https://support.espn.com/hc/en-us/articles/4669508364436-League-Manager-Powers

S3V XI deliberately does not copy Dream11's pricing/budget mechanics: the project must remain free and have no bidding, spending, betting or purchases. FPL's current eight-chip full-season schedule is not automatically suitable for a short local cricket tournament. ESPN scoring changes may recalculate historical outcomes; S3V XI should require deliberate rule-version migrations and audit notes before doing so.

## Priorities

| Priority | Problem | Impact | Effort | This update |
| --- | --- | --- | --- | --- |
| P0 | No trusted shared competition backend, locks or manager standings | Very high | High | Documented blocker; no fake launch |
| P0 | CSV/import revisions and local data lack verified approval | High | High | Validation strengthened; approval deferred |
| P1 | Bench/reserve swap impossible in filled lineup | High | Low | Fixed with atomic selection swap |
| P1 | Squad draft discarded on refresh | Medium | Low | Local, versioned draft persistence with validation |
| P1 | Scoring configuration hard-coded / anonymous | High | Medium | Central rules object and published version; storage migrations deferred |
| P1 | Player scouting lacks direct comparison | Medium | Low | Two-player historical comparison added |
| P1 | Demo scores easily mistaken for live | High | Low | Language corrected and disclaimers retained |
| P2 | Round histories, form charts, rivalry mini-leagues | Medium | High | Defer pending accurate match data and player accounts |
| P2 | Visual/polish, mobile gestures, motion | Low | Medium | Defer until live browser testing |

## Actual code changes

- `components/SquadDemo.tsx`: Search and restore/persist demo squad; reset action; reserve-to-starter swap; feedback; preserves captain/VC validity.
- `lib/squad-workspace.ts`, `lib/squad-workspace.test.ts`: Validation of untrusted local drafts, atomic bench swaps and regression tests.
- `components/PlayerDirectory.tsx`: Side-by-side comparison of two tournament player records with accessible selection buttons, clear-on-tournament switch and explicit provenance.
- `lib/scoring-rules.ts`, `lib/scoring.ts`, `lib/scoring.test.ts`: Named immutable points defaults, rule version and validation regression cases.
- `app/points/page.tsx`, `components/MatchCentre.tsx`: Display rule version and source-match details.
- `app/page.tsx`: Corrected misleading live-score wording.
- `app/globals.css`: Modest styles for functional changes, including mobile layouts.
- `README.md`: Updated feature scope and limitations.

No user records, actual match statistics, GitHub branches, or live deployments were modified by these local source changes.

## Production blockers and next milestones

1. **Authentication and storage (high complexity)**: Supabase user accounts, RLS, manager teams, competition membership, snapshots and server-side forms; otherwise selections cannot compete fairly.
2. **Competition structure (medium-high)**: Real tournament fixtures, multi-match fantasy rounds, lock deadlines in `America/Toronto`, server checks, double-participation and postponed games.
3. **Import pipeline (high)**: Authorized CricHeroes API if obtainable, otherwise protected scorecard CSV/manual import with player-ID reconciliation, duplicate detection, revision history, provisional/final status and admin approval.
4. **Fantasy manager standings (high)**: Score only locked squad snapshots with a versioned rule set, accurate captaincy fallback, bench substitution participation rules, deterministic ties, audit history.
5. **Release verification (medium)**: Install dependencies, run tests/typecheck/build and inspect keyboard, small-screen and touch behavior. The current execution environment cannot download dependencies, so production build status must remain unverified.

Do not use the match-level localStorage workspace as authoritative input for public leaderboards. Do not present tournament aggregates as individual match fantasy totals. Do not pretend an unsupported CricHeroes feed exists.
