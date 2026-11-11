# TenderAtlas — Source-backed procurement intelligence

**Deployment-ready Cloudflare Pages project** with a live multi-source procurement directory, account security, company relevance profiles, saved notices, opt-in email alerts, and server-verified Stripe subscription entitlements. No seeded or fabricated procurement listings.

> **Status:** The application, database schema, endpoints and mocked E2E integration tests have been implemented and built. The upstream APIs, live emails, Cloudflare Pages runtime, actual Stripe transactions and final mobile UI rendering have **not** been tested against deployed accounts. Do not accept real payments until staging verification and publication of appropriate privacy/terms documents.


## Product-quality upgrade (v1.1, staging branch)

This release improves the **actual product**, not just its colors:

- Premium, responsive editorial dashboard with a redesigned explorer, source coverage cards, in-view deadline filters, result sorting, sector shortcuts, and detailed notice dialogs.
- **Working guest shortlist** saved only on the current device (capped at 60 records). Sign-in and cross-device storage continue to require D1 + Resend. No fake account sync.
- **CSV export** of real fetched notices, with spreadsheet formula-injection protections, and shareable filtered search URLs.
- Corrected Greek CPV parsing when the official `cpvs[].key` contains the numeric code and `cpvs[].value` contains the translated label. Original ADAM notice PDFs now link directly to the publisher's attachment endpoint.
- TED search covers selected published competitive notice categories (standard, social, design, qualification, prior information calls for competition). It does **not** assert a record is legally open or available to every bidder.
- UK Find a Tender follows safe official OCDS pagination with a **bounded scan**: up to two recent pages without a keyword, up to three pages when searching keywords. It is not a complete keyword index; the interface discloses that explicitly.
- Optional US **SAM.gov Get Opportunities v2** adapter. Requires a server-side `SAM_API_KEY`; no user-facing US search claim or API-key exposure before it is configured.
- Source response transparency, errors, dates, publisher provenance and localized CPV categories. The data methodology is linked from `/methodology.html`.
- Data source, URL, input, source-failure, safety, spreadsheet export, match and subscription tests are run with `npm run check`.

**Deployment observations:** The Cloudflare Pages project `tender-atlas` currently has no production D1 or Workers AI binding and no runtime secrets. Accordingly, real logins, email alerts, AI, US-only search and Stripe payments are **not enabled in production**. Do not describe them as currently live or sell subscriptions before completing provider configuration and end-to-end test-mode checks.

**Local test:** `npm run check`. **Pages settings:** `npm run build` → `dist`. Do not deploy `public/` as the production output directory.

**SAM.gov enablement (optional):**
1. Obtain an API key from your own SAM.gov account (see the official [Get Opportunities Public API](https://open.gsa.gov/api/get-opportunities-public-api/) docs).
2. Add `SAM_API_KEY` as an **encrypted Cloudflare Pages runtime secret**, never as a GitHub variable or frontend code.
3. Redeploy and inspect `/api/health` (`features.samGov: true`). Search `?source=sam&country=USA&days=30`, inspect notices against SAM.gov and API quotas before advertising US coverage.
4. The SAM.gov direct UI link can require elevated access; if unavailable, the app sends users to the official search portal with the original notice reference.

**Safe rollout / rollback:** Merge a reviewed, green PR only after confirming the Pages preview serves the app and the existing official-source search. If production behaves unexpectedly, use Cloudflare Pages → Deployments → Rollback to the previous successful production deployment, then revert the merge commit (or reverse the squash commit) in GitHub. Do not migrate production D1 or enable live Stripe as part of a visual release.

## What is working in source code

| Capability | Status / deployment dependency |
|---|---|
| TED Search API v3 | Extended competitive types; no API key, upstream runtime verification required |
| ΚΗΜΔΗΣ Open Data API | Improved CPV mapping + ADAM PDF links; no API key, upstream runtime verification required |
| Find a Tender OCDS | Bounded pagination (1–3 recent release pages); **not** exhaustive UK keyword search |
| Search, filters, pagination, partial-source errors | Implemented; in-view status/sort; per-source TED/Greek/SAM pagination; UK scan is bounded |
| Detailed official provenance and deadline confidence | Implemented, original publisher always linked |
| Passwordless email sign-in | Implemented; requires D1 + Resend + SESSION_SECRET |
| Persistent company profiles and watchlists | Cross-device accounts require D1; anonymous users can save locally on their device |
| Transparent keyword / CPV / country relevance | Implemented, heuristic only; does **not** verify eligibility |
| Semantic match via BGE-M3 | Implemented; requires Workers AI binding and active paid subscription; quotas enforced |
| Opt-in search alerts + daily digest scheduler | Implemented; requires D1 + Resend + CRON_SECRET + GitHub Actions secrets |
| Stripe checkout / portal / verified webhooks | Implemented; requires Stripe products, API secrets and test-mode verification |
| SAM.gov (USA) | Adapter implemented; **disabled** until Cloudflare secret `SAM_API_KEY` is supplied |
| SEO-first individual indexed tender detail pages | **Not implemented**; only the landing/methodology are indexable; no mass-generated thin listings |

## Launch: GitHub → Cloudflare Pages

1. Create a **new, empty GitHub repository** named `tender-atlas`, with no README/initial commit. Copy this project into its root, then push to `main`:

   ```bash
   git init -b main
   git add .
   git commit -m "Launch TenderAtlas"
   git remote add origin https://github.com/YOUR_GITHUB_OWNER/tender-atlas.git
   git push -u origin main
   ```

   Or, if the GitHub CLI (`gh`) is installed and signed in, run this **single safe publish command** from the unpacked project directory to create the repository and push the code automatically (change the account name):

   ```bash
   ./scripts/create-github-repo.sh
   ```

   The helper creates the repo under your **currently active GitHub CLI account**; to select a particular owner explicitly use `./scripts/create-github-repo.sh douphealth private` (or the desired owner). It refuses existing repository names and does not overwrite remotes. **Never place API keys in the repository.**

2. Cloudflare Dashboard → **Workers & Pages → Create application → Pages → Connect to Git** → select `tender-atlas`.
3. Set **production branch** `main`, **framework preset** `None`, **root directory** `/`, **build command** `npm run build`, **build output** `dist`.
4. Save and deploy. The public directory and `/api/search` are available immediately, subject to official-source connectivity. Account, AI, alerts and paid features require the optional steps below.
5. Confirm that `https://YOUR_PROJECT.pages.dev/api/health` returns JSON and `https://YOUR_PROJECT.pages.dev/api/search?source=ted&days=7` either returns real notices or a clearly reported source error. If the official source fails, the UI **must not** display sample content.

Cloudflare reference: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/ and https://developers.cloudflare.com/pages/functions/.

## Enable accounts: D1 + Resend

1. In Cloudflare **D1**, create a database, e.g. `tender-atlas-prod`.
2. Open the D1 SQL console. Execute **`migrations/0001_initial.sql`** and then **`migrations/0002_ai_usage.sql`**. Both are idempotent for initial installation. For a production database, take a backup before future migrations.
3. Open **Pages project → Settings → Bindings** and add a **D1 database** binding named **exactly `DB`** referencing the created database. Use separate databases for preview and production.
4. Verify a domain with Resend and generate a Resend API key. Add Cloudflare **runtime environment variables / secrets** as shown in `.env.example`: `SESSION_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`. Generate `SESSION_SECRET` using `openssl rand -hex 32`; don't reuse it for other services.
5. Redeploy the Pages project. Open `/api/health`: `features.accounts` must be `true`. Test the OTP email flow end-to-end, confirm a valid code authenticates once and wrong codes fail. Set email sending domain SPF/DKIM as Resend requires.

Cloudflare binding reference: https://developers.cloudflare.com/pages/functions/bindings/.

## Enable semantic relevance (optional AI)

- Add **Workers AI** binding named `AI` under Cloudflare Pages Functions bindings.
- Cloudflare runs the `@cf/baai/bge-m3` multilingual text embedding model for opted-in paid users. The endpoint `/api/match` computes cosine similarity between the company's submitted description and the selected notice's title/buyer/CPV identifiers. It does **not** provide an AI-generated explanation of requirements or estimate bid-winning probability.
- Quotas: **Pro 10, Team 50, Advisor 200 per UTC day**. These are enforced in D1 to bound usage. Checkout will not automatically turn on AI; the AI binding must be configured.
- Relevant model documentation: https://developers.cloudflare.com/workers-ai/models/bge-m3/.

## Enable Stripe (test-mode first)

1. Create recurring monthly Stripe Prices with intended currencies/amounts; `Pro €39`, `Team €99`, and `Advisor €249` are **proposed** values only, excluding applicable taxes. Decide on VAT obligations, invoicing and product policies before live payments.
2. Set Cloudflare encrypted runtime secrets: `STRIPE_SECRET_KEY` (`sk_test_...`), `STRIPE_WEBHOOK_SECRET` (`whsec_...`), and `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_ADVISOR` (Stripe Price IDs); also set `APP_URL` to the actual HTTPS site origin.
3. Create a Stripe webhook endpoint: `https://YOUR_PROJECT.pages.dev/api/billing/webhook` and subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Store the webhook signing secret in the Cloudflare environment, **not GitHub**.
4. Enable the Stripe Customer Portal in the account. In **test mode**, validate new purchase, return-from-checkout pending state, verified webhook upgrade, payment failure, trial state, cancel, renewal, subscription change via portal, webhook replay and event ordering.
5. Only swap to live Stripe keys/price IDs after real end-to-end tests, legal/tax preparation, and verification that entitlements match the subscription status.

Notes: Checkout blocks a second subscription for a user whose subscription is already active/trialing. Paid access never depends on a browser query string; only verified subscription status in D1 unlocks AI and expanded quotas. Billing plan changes and canceled states are Stripe-controlled.

## Enable daily email alerts

1. Set Cloudflare secret `CRON_SECRET` to **another** independent, random 32-byte secret.
2. In the GitHub repository → Settings → Secrets and variables → Actions, set `APP_URL` to your production Pages HTTPS origin and `CRON_SECRET` to the *same* secret as Cloudflare.
3. The workflow `.github/workflows/daily-alerts.yml` runs at approximately **07:15 UTC** (GitHub schedules can be delayed) and supports manual `workflow_dispatch`.
4. Runs process a bounded batch of up to 20 stale alert records per invocation. A `last_checked_at` checkpoint and per-notice delivery IDs reduce duplicate emails; a job may need repeat invocations for larger installations. Source failures are logged. Email volume and API quotas must be monitored.
5. Before enabling production delivery: verify source freshness, proper unsubscribe (deleting an alert), SPF/DKIM, bounce handling, and provider limits. **GitHub Actions secrets are required; without them the workflow safely exits.**

## Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | No | Installed feature flags |
| `/api/search` | GET | No | Live TED/ΚΗΜΔΗΣ/UK search |
| `/api/auth/request`, `/api/auth/verify` | POST | One-time code | Request and verify email OTP |
| `/api/auth/me` | GET | Cookie | Current user + tier |
| `/api/auth/logout` | POST | Cookie | Revoke session |
| `/api/account/profile` | GET, PUT | Cookie | Supplier profile |
| `/api/account/watchlist` | GET, POST, DELETE | Cookie | Saved source-backed notices |
| `/api/alerts` | GET, POST, DELETE | Cookie | Alert rules |
| `/api/match` | POST | Paid + AI binding | Semantic similarity |
| `/api/billing/checkout`, `/api/billing/portal` | POST | Cookie | Stripe session creation |
| `/api/billing/status` | GET | Cookie | Trusted local plan status |
| `/api/billing/webhook` | POST | Stripe signature | Verified subscription state |
| `/api/admin/dispatch` | POST | CRON_SECRET bearer | Daily opt-in email dispatch |

## Development + validation

Requires Node.js 20 or newer; CI uses Node.js 22. There are **no npm runtime dependencies**.

```bash
npm ci
npm run check
```

`npm run check` runs Node integration/unit tests and a deterministic static build. `dist/` is generated and intentionally excluded from Git. For local Pages Functions emulation, install Cloudflare Wrangler separately and follow the official local Pages/D1 bindings documentation; `npm run dev` invokes Wrangler via npx and requires network access if Wrangler isn't installed.

Source schema and API examples are tested using deterministic mocked upstream responses. **Container network DNS is disabled in the authoring environment**; live API and Cloudflare deployment validation therefore remain to be done in staging.

### API source contracts

- TED: https://docs.ted.europa.eu/api/latest/search.html and https://docs.ted.europa.eu/ODS/latest/reuse/field-list.html
- ΚΗΜΔΗΣ: https://cerpp.eprocurement.gov.gr/khmdhs-opendata/help
- UK Find a Tender: https://www.find-tender.service.gov.uk/Developer/Documentation

**Coverage honesty:** TED searches `cn-standard` contract notices published within the selected interval and does not cover every tender notice variant. ΚΗΜΔΗΣ may return canceled/amended notices, which are explicitly labeled. The UK adapter reads a limited recent OCDS page and keyword-filters that page locally, so it must never be marketed as complete UK coverage. US SAM.gov is not implemented in this package. Publication and deadline dates may change; always use the original authority as source of truth.

## Privacy, safety, and operational requirements

- Passwordless codes are HMAC-protected, expire in 10 minutes, and have rate limits; browser sessions use HttpOnly, SameSite=Lax cookies. Database binds must be server-only.
- Browser-supplied price IDs and client-side subscription claims are never trusted. Stripe events are authenticated with HMAC signatures and deduplicated. API keys remain server secrets.
- The code does **not** certify procurement eligibility, legal compliance, completeness of coverage or AI reliability.
- Configure a legal operator, privacy notice, terms, cookie notice (if needed), billing/refund terms, data retention/deletion requests, GDPR duties, email unsubscribe processes and appropriate attribution **before collecting production users or charging money**. These are specific to the eventual operating entity and cannot honestly be filled with fictional details.
- For production, set observability, rate limits (including per-IP search protection), backup/restore procedures, monitoring, Stripe reconciliation and browser-based accessibility tests. None of those is confirmed in an actual deployment yet.

## Rollback

Revert the last GitHub commit and allow Cloudflare Pages to redeploy the previous deployment, or use Cloudflare Pages deployment rollback. **Git rollback does not roll back D1 or Stripe state**. Make D1 backups before schema modifications and keep payment customer records intact.
