# Update 04 — Multi-tournament management and team cap

## Scope and implemented changes

| Category | Files | Functionality |
|---|---|---|
| Authentication / server | `lib/supabase.ts`, `lib/api-auth.ts`, `lib/client-api.ts`, `/app/login`, `/app/api/**` | Supabase Auth password sign-in/signup; bearer JWT verification; admin role checks; RLS-bound database access; controlled tournament/squad actions |
| Tournament management | `components/TournamentAdmin.tsx`, `app/admin/**` | Create draft competitions, tabs, team/player/fixture imports, manual add/edits, publication, basic manager submission list |
| Spreadsheet imports | `components/TournamentImporter.tsx`, `lib/imports.ts` | CSV and XLSX first-sheet import, per-column mapping, preview, deduplication and input validation; explicit draft schedule replacement |
| Manager experience | `components/TournamentExperience.tsx`, `app/tournaments/**` | Tournament selector, independent teams/rosters/fixtures, authenticated manager squad saves and lineup edits |
| Mandatory cap | `lib/tournament-rules.ts`, `lib/fantasy.ts`, `components/SquadDemo.tsx`, SQL trigger | 3 players maximum per real cricket team by default, counted across bench + starters; UI blocks fourth; API and DB trigger independently enforce |
| Backend schema | `supabase/migrations/202610230001_s3v_multi_tournaments.sql` | Tournament-scoped tables, composite FKs, RLS policies, audit events, verified player IDs, immutable published configuration, score-record schema foundation |
| Time handling | `lib/timezone.ts` | Match and deadline timezone localization, Ottawa defaults, DST gap rejection |
| Tests | `lib/tournament-rules.test.ts`, `lib/imports.test.ts`, `lib/timezone.test.ts` | Club cap, squad validation, input imports and DST regressions |

The update layers on top of the S3V XI Update 03 source. It does not delete the existing historical archive or scorecard demo.

## Technical limitations / unverified work

- Changes were prepared as a local code package. The GitHub integration returned a **403** for branch creation. No remote branch, PR, merge, production deployment or live database migration was performed.
- Syntax checks on all TS/TSX files, a strict compile of core pure TypeScript modules, and focused runtime smoke assertions passed.
- Full `npm install`, `npm run test`, `npm run typecheck`, and `npm run build` could not run in this environment, as necessary npm packages were unavailable offline. Validate all on a real workstation/CI before publishing.
- Supabase migration and RLS policies have been reviewed in source but **not executed on a live PostgreSQL database**. Apply to a test Supabase project first and validate the roles and trigger behavior.
- No verified match-level scoring feed, official CricHeroes API, manager point aggregation, round snapshots, locked lineups, transfers or actual shared fantasy leaderboard in this update. These require the next scoring milestone.
- Admin edits and bulk replacements intentionally stop after publication. Post-publication rescheduling and player transfers require explicit, auditable corrections that preserve locked lineups; this is deferred.
- Logo support is an optional HTTPS URL, not binary file storage. XLSX parsing reads the first worksheet.
- No fantasy budgets or player valuations are added, honoring the original free/no bidding requirements.

## Release checks

1. Run migrations on a fresh test Supabase project. Verify RLS denies nonadmins, admins can import and publish.
2. Ensure direct PostgREST insertion of a 4th player from one team raises a DB trigger exception.
3. Test two independent tournaments with overlapping player IDs and no cross-contamination.
4. Test draft imports/duplicate IDs, fixture replacements, timezones and unauthorized requests.
5. Run Vitest, TypeScript, Next production build, and test desktop/mobile interactions on the actual deployment.
6. Push the code and let Vercel build a preview branch; configure Supabase project URL/public key and redeploy.

See `docs/TOURNAMENT_SETUP.md` for the setup procedure.
