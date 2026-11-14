# TenderAtlas v10.6 — Cloudflare Pages deployment

This repository now builds the **v10.6 application extracted from the user-provided Cloudflare Pages Direct Upload ZIP**. The repository is connected to Cloudflare Pages through Git.

## Active application

- `public/_worker.js` — Advanced-Mode Pages Worker, serving `/api/search`, `/api/health`, `/api/ics` and unverified metadata summaries at `/api/dossier`.
- `public/index.html`, `public/assets/`, `public/methodology.html`, `public/privacy.html`, `public/sw.js` — responsive website, local-first workspace, methodology/privacy and PWA assets.
- `scripts/build.mjs` — copies `public/` into `dist/` without modifying source files.
- `migrations/0010_enterprise_d1.sql` and `docs/v10.6/direct-upload-wrangler.toml` — **examples only**: D1 is not configured and there are no D1 queries in the v10.6 Worker.
- `legacy/v3/` — previous Pages Functions/backend, tests, and repository release notes, retained for reference and rollback.

## Cloudflare Pages Git build

Existing Cloudflare Pages project: `tender-atlas`; production branch `main`.

- **Build command:** `npm run build`
- **Build output:** `dist`
- **Node:** 22 recommended (20+ supported).
- `public/_worker.js` is copied to `dist/_worker.js`. The previous root `functions/` directory was archived, because Pages Functions and Advanced-Mode `_worker.js` must not both be active.

Validate locally: `npm ci && npm run check`. Use `npx wrangler pages dev dist` for interactive Cloudflare Pages checks if Wrangler is available, or use the live Pages preview after deployment.

## Important product limitations

v10.6 performs bounded live queries against official public procurement sources (TED, KIMDIS, UK Find a Tender, BOAMP, World Bank and SAM.gov). SAM.gov requires `SAM_GOV_API_KEY` configured as a Cloudflare Pages secret. It can take time for official sources to respond, and live source coverage is not exhaustive.

This **does not include operational logins, multi-device synchronization, scheduled email alerts, verified AI eligibility assessments or Stripe subscriptions**. The dossier route reports *unverified metadata* and is not a source-cited eligibility decision. Do not promise these capabilities to paying customers. The D1 SQL does not create/bind a database automatically.

## Deployment and rollback

After pushing to `main`, verify GitHub Actions, Cloudflare Pages build logs and live `/api/health`, then test `/api/search` and the browser interface with genuine records. If regression occurs, use GitHub's revert mechanism against the v10.6 commit, or roll back to the prior successful Cloudflare Pages deployment. Previous code is preserved under `legacy/v3/` and in Git history.

Source provenance: `TenderAtlas_v10_6_Cloudflare_Direct_Upload.zip` supplied by the repository owner; test fixtures must never be represented as official live data.
