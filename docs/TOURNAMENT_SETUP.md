# Update 04: multi-tournament setup (Vercel + Supabase)

## What is implemented

- `/admin`: authenticated role-protected tournament creation and list.
- `/admin/tournaments/[id]`: working tabs for tournament overview, schedule, cricket teams, players, rules, fantasy managers, and a clearly marked not-yet-available manager leaderboard.
- CSV and XLSX imports with field mapping, preview and row validation for teams, players and fixtures; downloadable CSV examples; add and edit draft records; optional explicit draft fixture replacement.
- `/tournaments` and `/tournaments/[id]`: browse published competitions, fixtures, rosters, create and save a separate fantasy squad for each tournament.
- Default 15-player roster, 11 starters and 4 substitutes, 2 WK / 5 BAT / 3 AR / 5 BOWL, captain and vice-captain, and **3 players maximum from a single registered cricket team**. The cap is validated in the UI, the route handler and the PostgreSQL trigger on every squad insert/update.
- Permissions are protected by Supabase Auth plus PostgreSQL Row Level Security. **Do not use a service-role key in the Next.js app.**
- Imports and rule modifications are draft-only so scores, locked roster assignments and user submissions aren't quietly changed.

## One-time database setup (required before using authenticated features)

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/migrations/202610230001_s3v_multi_tournaments.sql` once. Use a new project or review its impact before applying to an existing database. It creates tables with `s3v_` prefixes, policies, constraint triggers, and import/publish functions.
3. Enable Email/password auth in Supabase Authentication → Providers. Set the site's redirect URLs as needed. Create/sign up your administrator account using `/login`, and confirm its email if required.
4. In the **Supabase SQL editor**, grant admin access explicitly to your account (replace the example address):

```sql
insert into public.s3v_admins (user_id)
select id from auth.users where email = 'YOUR_ADMIN_EMAIL@example.com'
on conflict (user_id) do nothing;
```

5. Copy the project's public URL and publishable/anon key to `.env.local` for local development and to the Vercel Project → Settings → Environment Variables for Production and Preview:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Do **not** add a `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`. This application uses the JWT of the signed-in user and RLS. Restart local dev and **redeploy on Vercel** after setting variables.

## Administrator workflow

1. Visit `/login` and sign in with the designated admin account.
2. Open `/admin` and click **+ Add New Tournament**. This creates a draft.
3. Under **Cricket Teams**, add teams manually or upload the `teams.csv` template.
4. Under **Players**, confirm real player identity and roles, then upload CSV/XLSX or add manually. `external_id` should be the CricHeroes player ID when available. Registration and identity are separate.
5. Under **Schedule**, upload CSV/XLSX, check team mappings and match times, review the preview and confirm. All match IDs must be unique in the tournament. Existing fixture IDs require explicit **Replace** during draft.
6. Under **Fantasy Rules**, confirm the default cap of 3 and set a registration deadline.
7. Publish only once the competition has sufficient teams, role coverage, a schedule and a deadline. Publishing freezes roster/fixture imports to avoid invalidating user squads.
8. Managers sign in, choose `/tournaments`, select the tournament and save an eligible 15-player fantasy squad. Their captain and vice-captain must be distinct starters.

For local Canadian tournaments use `America/Toronto` unless the competition operates elsewhere. Schedule XLSX dates should be displayed as `YYYY-MM-DD` and times `HH:mm` 24-hour. Tournament input rows carry local date/time values; Postgres resolves them with the tournament's configured timezone.

## Data safety and limitations

- The four historical CricHeroes leaderboard collections already packaged under the Player Archive remain scouting-only. They are **not match fantasy scorecards**, and they do not create points automatically.
- The earlier Match Centre and player-points leaderboard are still **browser-local demo tools**, not a league-authoritative points system.
- `s3v_match_performances` is an isolated, RLS-protected foundation for future verified match scoring; neither match imports nor manager score aggregation are implemented in this update.
- Administrator tabs for fantasy managers and leaderboard show real manager submission counts and an honest unavailable state; they do not invent standings.
- `s3v_fantasy_squads` stores a user's *current* tournament squad, not a locked round snapshot. Round-based deadlines, transfer history, substitution rules and strategy-card redemptions still need a server-side implementation before formal league competition.
- The server blocks imports and structural changes to published competitions. Post-publication postponements, team transfers, scoring corrections and exceptional adjustments require a future audited override workflow (not silently permitted).
- The import parser accepts one XLSX sheet (first sheet) at a time and CSV; input is limited to 3 MB / 2,000 rows per batch. Upload is parsed in the browser and sent to protected API routes; no spreadsheet files are permanently stored.
- Vercel serves the web app; **Supabase** is the shared system of record. Without the environment variables and migration the website still builds and runs the old demo, but admin/tournament APIs report not configured rather than pretending to save.

## Verify locally

```bash
npm install
npm run test
npm run typecheck
npm run build
npm run dev
```

Test admin auth failures, creation, team import, invalid roster rejects at 4th teammate, browser refresh restoration of a saved authenticated squad, and deadline rejection. Verify deployed `/api/health` (unrelated demo health route) and `/tournaments` after configuring env vars.

### Critical database integrity check

Direct insertion with four players from the same `s3v_cricket_teams.id` must be rejected by `s3v_enforce_squad_trigger`, even when sent to PostgREST directly using the authenticated user's JWT. Neither the UI nor route validation is trusted as the final authority.
