# Scoring rules → tests

All scoring lives in one pure module: `lib/scoring/rules.ts`. No I/O, no clock, no randomness.
Pages, charts, the API and the tests all call it. Run the suite with `npm test`.

Test files:

- `lib/scoring/rules.test.ts`: points, aggregation, tie-breaks, selections, awards, validation
- `lib/draw/draw.test.ts`: the match-day draw
- `lib/league/ledger.test.ts`: lifecycle, corrections and recalculation

## Edge-case table

| Rule from the brief | Implementation | Test id |
|---|---|---|
| Point values: goal +5, assist +3, own goal −2, second assist +1 | `POINTS` | R00 |
| Goal scored by a field player: +5 | `scoreEvent` | R01 |
| Assisted goal: scorer +5 and assister +3 | `scoreEvent` | R02 |
| Own goal: −2 to the scorer. It's not a goal for the opponent's stats but it still counts on the scoreboard | `scoreEvent`, `scoreMatch`, `scoreline` | R03 |
| Assists on own goals earn nothing | `scoreEvent` | R04 |
| Deflection is own goal vs goal; the admin picks and the default is own goal | `deflectionRulingOf` | R05, R06 |
| The deflection default is configurable, and a ruling recorded on the goal always wins | `ScoringRules.deflectionDefault` | R07 |
| Second assist is off by default | `DEFAULT_RULES` | R08 |
| Second assist is +1 when enabled, never to the scorer or assister, and never without an assist | `scoreEvent` | R09 |
| Solo goal: scorer +5, no assist points | `scoreEvent` | R10 |
| Penalty: +5. No assist unless the admin records one | `scoreEvent` | R11 |
| Direct free kick: +5, no assist even if one is recorded | `scoreEvent` | R12 |
| Header from a cross: normal goal + assist | `scoreEvent` | R13 |
| A player can't assist their own goal | `scoreEvent`, `validateScorecard` | R13b, R24 |
| Scores and assists in one match: both count | `scoreMatch` | R14 |
| Drop-ins get identical point values | `scoreMatch` | R15 |
| Negative totals are allowed (no floor at zero) | `buildStandings` | R16 |
| "Played, 0 points" is shown differently from "didn't play" | `scoreMatch`, `buildStandings` | R16b |
| Only played matches count | `playedMatches` | R29 |
| Form = last 5 played match days | `buildStandings` | R30 |
| Tie-break 1: more goals | `rankStandings` | R17 |
| Tie-break 2: more assists | `rankStandings` | R18 |
| Tie-break 3: head-to-head | `headToHead`, `rankStandings` | R19 |
| Then a shared rank (1, 2=, 2=, 4) | `rankStandings` | R20, R20b |
| Pick-7 selector earns their picks' points, regardless of drawn team | `scoreSelection` | R21 |
| Selector table and hit rate | `buildSelectorStandings` | R22 |
| Drop-ins can be excluded from season awards and stay on the leaderboard | `computeAwards` | R23 |
| Scorecard errors block saving | `validateScorecard` | R24, L04 |
| Scorecard warnings are allowed | `validateScorecard` | R25 |
| A correction recalculates the standings, and its audit entry keeps the old version | `saveScorecard`, `buildStandings` | R26 |
| Corrections need a reason and only work inside the window | `saveScorecard`, `canCorrect` | R27 |
| Editing an old match re-ranks the season and changes later form | derived standings | R28 |
| Settings changes (second-assist toggle) recalculate everything and are audited | `updateSettings` | R31 |
| Selections: exactly 7, locked once the teams are drawn | `submitSelection` | L01 |
| Attendance locks at the draw | `setAttendance` | L02 |
| A scored match can't be deleted | `deleteMatchDay` | L03 |
| Draw is reproducible from its seed | `drawTeams` | D01, D09 |
| Draw is random across seeds and unbiased | `SeededRandom` | D02, D10 |
| Even split, plus a floater on odd headcounts | `drawTeams` | D03 |
| Floater duty rotates | `drawTeams` | D04 |
| Drop-ins are split evenly | `drawTeams` | D05 |
| The previous match's exact teams are avoided | `isRepeatOf` | D06 |
| Keep-together and keep-apart pairs | `violations` | D07 |
| Team sizes shrink with headcount; extra players become rolling subs | `drawTeams`, `formatLabel` | D08 |
| Impossible or contradictory rules fail loudly | `drawTeams` | D11 |

## Defaults I chose where the brief left room

- **Deflection.** The brief says "own goal vs assist". I read it as own goal vs the shooter's goal.
  - Ruled an own goal: −2 to the deflecting player. The shooter and any assisters get nothing.
  - Ruled a goal: shooter +5 plus any assist.
  - The ruling is saved on each goal. Changing the default later never rewrites history.
- **Penalty assists.** An assist on a penalty counts only if the admin records one (for example, the pass before the foul). Winning the penalty is never an assist on its own.
- **Selectors.**
  - A selector scores the *same* points their seven players earned, including own goals.
  - A "hit" is a pick who scored or assisted. Own goals are not hits.
  - Selectors can pick themselves and drop-ins.
  - A pick who didn't play scores 0.
- **Head-to-head** compares points earned only in the match days both players played. With three or more players tied, they're ordered by pairwise head-to-head wins. Anyone still level shares the rank.
- **Correction window.** It runs from the first time the scorecard is published, not from the last edit. The default is 7 days and admins can change it.
- **Second-assist toggle.** It's a season-wide setting, so switching it rescores past matches too. The rules page says so.
