# S3V XI

**Your League. Your Eleven.** A free fantasy cricket concept for local/community leagues, beginning with Ottawa.

## Milestone 1: interactive fictional demo

- Next.js + React + TypeScript responsive landing page and brand identity.
- Fictional 20-player cricket pool, editable 15-player squad, starting XI and four reserve players.
- Captain (2x) and vice-captain (1.5x) multiplier choices.
- **Full Squad** (bench points) and **Skipper x3** (captain triple points) browser-only chip previews.
- Deterministic demo scoring with tests.

**Not production ready.** No actual CricHeroes integration, shared persistence, authentication, database, transfer engine, confirmed match scores, deadline enforcement, auto-substitution or leaderboard exists yet. The initial fantasy XI demonstration uses fictional player statistics; the player archive contains real historical aggregate leaderboard figures, and the match workspace has no verified match figures. The demo is not affiliated with CricHeroes or Fantasy Premier League.

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


## Update 02 — Player points and match centre

Added playable routes:

- **`/points`** — click-through scoring guide and live points calculator.
- **`/players`** — browsable player archive from the four uploaded tournament leaderboards.
- **`/match-centre`** — match-stat entry, CSV import/export, score breakdown and clickable player point standings for the Canterbury T20 vs Kanata T20 match reference.
- **`/leaderboard`** — player points rankings calculated from locally entered match figures.

The historical CSVs are cumulative tournament totals, **not match scorecards**. No automatic CricHeroes API access is claimed. The matched scorecard URL opens on CricHeroes; you must supply individual match statistics by manual entry or a permitted CSV export. Imported figures are stored in your browser only, not shared with other users.

Refer to [Update 02 documentation](docs/UPDATE_02.md) for exact formats, limitations and fantasy scoring rules.

## Update 03 — Product audit and usable improvements

- The fictional team builder now restores and saves draft selections in **local browser storage** (not a manager account). Invalid/tampered drafts fall back to the sample lineup.
- Swap a reserve into a full starting XI without breaking the 15-player roster. Captaincy is cleared if its player moves to the bench.
- Search the demo player pool and reset locally saved demo choices.
- Compare two historical player records side-by-side on `/players`, without claiming match-by-match analytics.
- Centralized, immutable scoring defaults with published `s3v-t20-v1` rules identifier. Added targeted validation and swap tests.
- Corrected home-page language to make clear that player match data is not an official live feed.

See [Product audit](docs/PRODUCT_AUDIT_03.md) for benchmark notes, unimplemented functionality and limitations. The application still lacks a shared database, legitimate fantasy-manager rankings, score verification and league lock rules.
