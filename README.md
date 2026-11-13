# RSFC League

**Your club. Your seven.** RSFC's in-house soccer league:

- Every match day, a seeded random draw splits whoever turns up into two teams.
- Points come only from the scorecard: goal +5, assist +3, own goal −2.
- Pick 7 lets every player back seven teammates before the draw.

Built with Next.js 16 (App Router), React 19, Recharts and TypeScript. It deploys on Vercel and stores data in Upstash Redis.

## Quick start (local)

```bash
npm install
npm run seed:demo     # optional: a fake 9-match-day season so the charts have data
npm run dev           # http://localhost:3000
```

- **Admin passcode in local dev:** `rsfc`. You can override it with `ADMIN_PASSCODE` in `.env.local`.
- **Local data:** stored in `.data/rsfc-league.json`. Delete that file to start a clean season.

```bash
npm test              # 50 unit tests: scoring rules, draw engine, corrections
npm run lint          # type-check
npm run build && npm start
npm run verify-draw   # re-run every recorded draw from its seed
```

## Deploy to Vercel

1. Push to the GitHub repo that's already linked to the Vercel project. It's detected as Next.js and needs no config.
2. In **Vercel → Storage → Marketplace → Upstash Redis**, create a free database and connect it to the project. This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Add environment variables:
   - `ADMIN_PASSCODE`: the club's admin passcode. Required in production.
   - `SESSION_SECRET`: a long random string, used to sign the admin cookie.
4. Redeploy.

Without Redis, the app still runs on Vercel, but it keeps data in memory and shows a warning banner. Don't run a season like that.

## Match-day flow

1. **Admin → New match day.** Set the date and optionally tick attendance.
2. **Pick 7.** Players choose their name and seven picks. Picks stay hidden until the draw.
3. **Draw** (admin, at the pitch):
   - Finalise attendance, set the rules (split drop-ins, avoid repeat, keep together or apart, max per side) and press *Draw the teams*.
   - The seed is published. Anyone can press *Verify draw*.
4. **Scorecard** (admin, after full time):
   - Enter one entry per goal: team, type, scorer, and an optional assist or pre-assist.
   - Errors block saving. Warnings (for example, an assist on a free kick) are shown and then ignored.
   - Publishing updates the table, the charts and the Pick 7 results.
5. **Corrections.** Inside the correction window (7 days by default), reopen the scorecard, change it and give a reason. The previous version is kept in the audit log.

## Project layout

```
config/club.ts            roster (18 members + 3 drop-ins): the single source of truth
lib/scoring/rules.ts      ALL scoring rules (pure) + rules.test.ts
lib/draw/draw.ts          seeded crypto draw, constraints, verification + draw.test.ts
lib/league/types.ts       data model
lib/league/ledger.ts      pure state transitions + audit log + ledger.test.ts
lib/league/derive.ts      standings, awards and summaries for the pages
lib/server/store.ts       Redis (Upstash REST, compare-and-set) / file / memory storage
lib/server/auth.ts        passcode → signed HttpOnly cookie
app/                      pages: / draw pick matches table stats rules admin; app/api/* route handlers
components/charts/        season race, goal involvement, form sparklines, contribution matrix, selector gauges
docs/SCORING.md           every rule mapped to its test
docs/DATA_MODEL.md        the stored document, explained
MIGRATION.md              pivot summary + what to delete from the old cricket codebase
```

## Changing things

- **Roster:** edit `config/club.ts`. Never change a player's `id` once they've played; add new players freely.
- **Point values:** change `POINTS` in `lib/scoring/rules.ts`, update the tests, and every page follows.
- **Rulings** (deflection default, second assist, excluding drop-ins from awards, correction window, draw defaults): change them in Admin → Settings.

## Design notes

- **Palette:**
  - Night navy `#0C1925`, carried over from S3V
  - Chalk `#F2EFE6`
  - Kit green `#3FD38A`
  - Bib gold `#E9B949` for drop-ins and awards
- **Chart series:** green / blue / gold / violet / coral, checked for colour-blind separation against the panel colour. Drop-ins also get a hatched fill and a badge, so they never depend on colour alone.
- **Charts:** every chart has a title, a units line, a source note and a table view.
- **Motion:** a gentle rise-in only, switched off under `prefers-reduced-motion`.
- **Fonts:** Barlow Condensed (display) and Inter (body). Both are self-hosted via Fontsource, with no external font requests.

## Known v1 limits

- **No player logins.** Anyone can submit Pick 7 as anyone. Every submission is logged with a timestamp. If it gets abused, add per-player PINs.
- **One shared admin passcode.** Rotate it by changing `ADMIN_PASSCODE`. Existing admin cookies stay valid until they expire unless you also change `SESSION_SECRET`.
