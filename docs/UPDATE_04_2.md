# S3V XI Update 04.2 — Tournament admin usability & safe match status

This update **extends the already implemented** Update 04 multi-tournament feature. No existing tables, historical player datasets, draft tournament records, or squads are replaced.

## Implemented

- Search entire roster by player name, stable CricHeroes ID, or club. Combine real team, role and availability filters; paginate 25 per page rather than hiding records after 150.
- Search fixtures by match ID, round, team, venue and current status; paginate with timezone-safe display.
- Display each cricket team's available/registered count.
- Allow authorized administrators to change a published match's **status** and HTTPS scorecard reference, with immutable teams, venue, start times, match IDs and round names. Valid transitions: scheduled → live/completed/postponed/cancelled/abandoned; live → completed/abandoned; postponed → scheduled/cancelled. Finalized, cancelled and abandoned statuses do not reopen themselves.
- Add a PostgreSQL trigger that audits post-publication match status/scorecard changes within the same transaction and rejects edits to published match structure, including direct PostgREST requests.
- Add a publication-time guard: registration must close by the first fixture, and the available roster must meet basic per-team cap capacity by total players and each role. This is **a necessary lower-bound check**, not proof that every possible role/team combination can form a valid XI; the existing server and PostgreSQL squad validation remain authoritative.

## Setup

Apply `supabase/migrations/202610240001_s3v_admin_rosters_and_match_status.sql` **after** the prior `202610230001` migration in a development/test Supabase project. This migration replaces a guard function and creates triggers; there are no destructive table operations. Production rollout should occur only after testing against your existing data.

Run locally: `npm install --include=dev && npm run typecheck && npm run test && npm run build`.

## Security and scoring scope

- Admin permissions are still checked by `authenticate(req,true)` and Supabase RLS. Published fixture changes are audited by a DB trigger; no server-side service secret is required by the browser.
- The existing 3-players-per-real-team rule remains enforced at UI, API and SQL trigger level, across all 15 selected players including four reserves.
- Marking a fixture completed **does not** import CricHeroes statistics or create verified fantasy points.
- Real tournament manager fantasy leaderboards remain deferred until match-level verified scorecard ingestion, immutable round squad snapshots and reproducible scoring are implemented.
- No direct CricHeroes API, scraping or live score synchronization is claimed.
