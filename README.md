# S3V XI

**Your League. Your Eleven.** A free fantasy cricket concept for local/community leagues, beginning with Ottawa.

## Milestone 1: interactive fictional demo

- Next.js + React + TypeScript responsive landing page and brand identity.
- Fictional 20-player cricket pool, editable 15-player squad, starting XI and four reserve players.
- Captain (2x) and vice-captain (1.5x) multiplier choices.
- **Full Squad** (bench points) and **Skipper x3** (captain triple points) browser-only chip previews.
- Deterministic demo scoring with tests.

**Not production ready.** No actual CricHeroes integration, persistence, authentication, database, transfer engine, confirmed match scores, deadline enforcement, auto-substitution or leaderboard exists yet. All player and match data is invented for demo purposes. The demo is not affiliated with CricHeroes or Fantasy Premier League.

## Run locally

Requires Node.js 22.x (matching Vercel).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run test
npm run typecheck
npm run build
```

## Vercel deployment

Deploy via [Vercel Git integration](https://vercel.com/new) using the existing `snj3vpaul/s3v-xi` repository. Framework is Next.js, root directory is `./`, and no environment variables are required for the fictional demo. The project includes `vercel.json`, `.nvmrc`, `.vercelignore`, a favicon and `/api/health` smoke-test endpoint.

See **[docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md)** for exact GitHub and Vercel steps.

## GitHub

Upload these files to your existing repository `snj3vpaul/s3v-xi` on a feature branch, review, then merge. Use `git clone` of the existing repository before copying this starter into it, rather than creating a new remote repository.

## Next milestones

1. Supabase Auth and PostgreSQL schema with RLS.
2. Server-enforced rounds, snapshots, transfers and chip activation.
3. Admin scorecard CSV/JSON import, corrections and audit logs.
4. Verified scores and standings, eventually private friend leagues.
5. Authorized CricHeroes integration if an official route is available; never scrape it without authorization.

See `docs/` for architecture, rules, integration principles and deployment.

> **Indexing note:** Search-engine indexing is deliberately disabled for this fictional prototype via Next.js metadata. Remove that restriction when real tournament data and legal/privacy documentation are ready.
