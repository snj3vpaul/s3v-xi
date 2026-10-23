# Deploy S3V XI to Vercel

> Current milestone: **fictional demo only**. The public website will show simulated players and scores. There is no database, login, saved squads, live scoring or CricHeroes data connection. The demo is designed to deploy with **no secrets or environment variables**.

## 1. Check the code locally (recommended)

1. Install **Node.js 22** and Git.
2. Open the repository folder in PowerShell or your terminal.
3. Run `npm install`, `npm run test`, `npm run typecheck`, and `npm run build`.
4. After a successful install, commit the generated `package-lock.json` for reproducible deployment. GitHub Actions may then switch from `npm install` to `npm ci`.

## 2. Put the starter files into the existing GitHub repository

The repository is already at [snj3vpaul/s3v-xi](https://github.com/snj3vpaul/s3v-xi). **Do not create a new repo.**

Clone the repository, copy the unzipped starter contents into the clone's root (including hidden dotfiles), and commit the result:

```powershell
git clone https://github.com/snj3vpaul/s3v-xi.git
cd s3v-xi
git checkout -b feat/vercel-starter
# Copy all extracted files into this directory, not into a nested subfolder.
npm install
npm run test
npm run typecheck
npm run build
git add .
git commit -m "feat: S3V XI demo with Vercel deployment"
git push -u origin feat/vercel-starter
```

Open a GitHub pull request, review the code and merge into **main**.

## 3. Deploy from GitHub through Vercel (recommended)

1. Sign in at https://vercel.com/ using GitHub.
2. Visit https://vercel.com/new and select **Add New → Project**.
3. Import **snj3vpaul/s3v-xi**. If it does not appear, enable its access in the Vercel GitHub integration.
4. Confirm these values:
   - **Project Name:** `s3v-xi` (or another available name).
   - **Framework Preset:** Next.js.
   - **Root Directory:** `./` (repository root).
   - **Build Command:** default (`next build` via `npm run build`).
   - **Install Command:** default (`npm install`, or `npm ci` if a lockfile exists).
   - **Output Directory:** framework default. Do **not** set `public`, `dist`, or `out`.
   - **Node.js version:** 22.x (aligned with `.nvmrc` and package engines).
   - **Environment variables:** none needed for this demo.
5. Select **Deploy**.
6. After deployment, check the provided URL and `https://<your-deployment-domain>/api/health`. The health endpoint returns `status: ok` and `mode: fictional-demo`.

Vercel creates preview deployments on non-production branches and production deployments from the connected production branch (normally `main`).

## 4. Validate the live site

- The homepage loads on desktop and mobile.
- Navigational links lead to the squad and cards sections.
- Squad starts with 15 players: 11 starters and four reserves.
- Captain/vice-captain selection changes points as expected.
- **Full Squad** includes reserve points.
- **Skipper x3** replaces, rather than stacks, the normal captain 2x multiplier.
- Chip selection remains browser-only; refreshing resets it.
- `/api/health` responds with a JSON body and HTTP 200.

## 5. Deploy updates

Push commits to your connected GitHub production branch. Vercel deploys them automatically. Feature branches/pull requests receive preview URLs.

## Troubleshooting

- **Repository missing from import list:** grant Vercel's GitHub integration access to `snj3vpaul/s3v-xi`.
- **Root Directory error:** use the repository root (`./`), not `app/` or a nested unzipped starter directory.
- **Module not found:** confirm all extracted `app/`, `components/`, and `lib/` folders were committed.
- **Build error:** run `npm run build` locally, review the failed Vercel Build Logs and compare Node versions.
- **Incorrect npm dependency resolution:** remove local `node_modules`, run a fresh `npm install`, verify tests and build, then commit the newly generated lockfile.
- **New env variables (future Supabase integration):** add them under Vercel project **Settings → Environment Variables**, never in Git. Do not place service-role secrets in `NEXT_PUBLIC_` variables.

## Alternative: Vercel CLI

```powershell
npm install -g vercel
vercel login
vercel link
vercel deploy          # preview
vercel deploy --prod   # production
```

The Git integration is preferred because it automatically deploys future commits.


## Update 02 deployment

The interactive points calculation is client-side and does not require additional Vercel environment variables. The bundled file `lib/historical-players.json` is static application data. Deploy the modified source to the GitHub repo's `main` branch and Vercel will rebuild Next.js. Test these paths after deployment: `/points`, `/players`, `/match-centre`, `/leaderboard`, and `/api/health`.

**Do not call the browser-local match entries a live public leaderboard.** The app has no backend authentication, authoritative match imports or persistent shared standings yet. A proper production release will require a secure database and server-side validation before scores are published globally.

## Update 04: Supabase-backed tournaments

The authenticated Tournament Management and public tournament selection features require a Supabase project, the SQL migration and the **public** `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables in Vercel. Read [TOURNAMENT_SETUP.md](TOURNAMENT_SETUP.md) first. Redeploy after configuring variables. No service-role key is required or permitted in the frontend.
