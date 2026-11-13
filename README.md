# RSFC League

**Your club. Your seven.** RSFC's in-house soccer league:

- **Every Thursday, 10 pm: White vs Red**, until summer. The fixtures are created automatically and published as a calendar feed.
- Every match day, a seeded random draw splits whoever turns up into the two teams.
- Points come only from the scorecard: goal +5, assist +3, own goal −2.
- **Pick 7, FPL-style.** Anyone with an account (email and password) picks 7 of the 21 players. The team carries over every week. Changes are free until the Thursday deadline, and reminders go out before each one.

Built with Next.js 16 (App Router), React 19, Recharts and TypeScript. It deploys on Vercel and stores data in Upstash Redis.

## Quick start (local)

```bash
npm install
npm run seed:demo     # optional: a fake 9-match-day season so the charts have data
npm run dev           # http://localhost:3000
```

- **Admin passcode in local dev:** `rsfc`. You can override it with `ADMIN_PASSCODE` in `.env.local`.
- **Demo accounts** (after `seed:demo`): `<player>@demo.rsfc`, password `demo-league`. The seed script prints one to try.
- **Local data:** stored in `.data/rsfc-league.json`. Delete that file to start a clean season.

```bash
npm test              # 63 unit tests: scoring, draw, corrections, accounts, carry-over, fixtures, calendar, reminders
npm run lint          # type-check
npm run build && npm start
npm run verify-draw   # re-run every recorded draw from its seed
```

## Deploy to Vercel

1. Push to the GitHub repo that's already linked to the Vercel project. It's detected as Next.js and needs no config.
2. In **Vercel → Storage → Marketplace → Upstash Redis**, create a free database and connect it to the project. This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Add environment variables (all are listed in `.env.example`):
   - `ADMIN_PASSCODE`: the club's admin passcode. Required in production.
   - `SESSION_SECRET`: a long random string. It signs the admin and account cookies. Changing it logs everyone out.
   - `SIGNUP_CODE`: recommended. It's a club code people need to create an account; share it in the group chat.
   - For reminder emails:
     - `RESEND_API_KEY` and `REMINDER_FROM`
     - `CRON_SECRET`: any random string. Vercel sends it to the cron route automatically.
     - `PUBLIC_BASE_URL`: your site address, used in email links
4. Redeploy. `vercel.json` registers two weekly cron jobs, which work on the free Hobby plan.

Without Redis, the app still runs on Vercel, but it keeps data in memory and shows a warning banner. Don't run a season like that.

## Accounts, Pick 7 and reminders

- **Join** (`/join`): name, email and password, with an optional link to your roster player (one account per player). Passwords are hashed with scrypt, and sessions are signed cookies that last 90 days.
- **My Team** (`/team`): pick 7 of the 21 players. The seven carries over to every following week until you change it, with unlimited free changes.
- **Deadline:** kick-off at 10 pm Thursday, or the moment the admin draws the teams if that's earlier. Each match day uses your seven as it stood at the deadline, so a change made after the deadline counts from next week.
- **Reminders:**
  - A site-wide banner shows in the last 3 days before a deadline. It says "you haven't picked" or "your 7 carries over — any changes?"
  - Emails go out Wednesday evening and Thursday midday through Resend. Each user gets at most one per slot, and can switch them off under Account.
  - The calendar feed (`/calendar.ics`, which you can subscribe to from Account or the home page) has alerts 1 day and 3 hours before kick-off.
- **Forgotten password:** an admin presses *Reset password* in Admin → Accounts and passes on the temporary password.

### Fixtures

The weekly series is set in `config/schedule.ts`: Thursday 22:00 America/Toronto, 19 Nov 2026 to 17 Jun 2027 (the last Thursday before summer), 31 fixtures.

- The fixtures are created automatically the first time the site loads.
- **Calling off a week:** delete it in Admin. It disappears from the calendar feed too.
- **One-off extra games:** add them in Admin.
- **Next season:** change `start`, `end` and `id` in `config/schedule.ts`.

## Match-day flow

1. **The fixture already exists.** Players set their Pick 7 on My Team before the deadline, and picks stay hidden until the draw.
2. **Draw** (admin, at the pitch):
   - Finalise attendance, set the rules (split drop-ins, avoid repeat, keep together or apart, max per side) and press *Draw the teams*.
   - The seed is published. Anyone can press *Verify draw*.
   - Drawing locks every account's seven for that night.
3. **Scorecard** (admin, after full time):
   - Enter one entry per goal: team, type, scorer, and an optional assist or pre-assist.
   - Errors block saving. Warnings (for example, an assist on a free kick) are shown and then ignored.
   - Publishing updates the table, the charts and the Pick 7 results.
4. **Corrections.** Inside the correction window (7 days by default), reopen the scorecard, change it and give a reason. The previous version is kept in the audit log.

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

## Known limits

- **No self-service password reset.** An admin resets it. That's deliberate: it needs no email set-up.
- **Accounts live in the league document.** Exports from Admin include password hashes, so keep backups private.
- **One shared admin passcode.** Rotate it by changing `ADMIN_PASSCODE`. Existing admin cookies stay valid until they expire unless you also change `SESSION_SECRET`.
