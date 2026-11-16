# TenderAtlas

An independent public-procurement directory built with TanStack Start, React, Tailwind CSS and Cloudflare. It reads official publisher APIs and never invents missing procurement fields.

## What is included

- Live fallback adapters for TED, BOAMP, World Bank, KIMDIS, Find a Tender and SAM.gov
- Optional Cloudflare D1 archive with FTS5 search, indexed filters, buyer history and scheduled ingestion
- Internal pages for every source, conservative cross-register reconciliation, country × CPV hubs and buyer profiles
- Dynamic notice sitemap entries, structured data and generated 1200×630 PNG share cards
- RSS feeds, double opt-in daily email alerts, dossier intake, Turnstile protection and optional Stripe Checkout
- Browser-only private workspace for saved tenders and searches

## Local development

```sh
bun install
bun run dev
bun test
```

No Lovable service, account, database or AI gateway is used.

## Owner-managed Cloudflare deployment

1. Create a D1 database in the owner's Cloudflare account:

   ```sh
   bunx wrangler d1 create tender-atlas
   ```

2. Copy `wrangler.example.toml` to `wrangler.toml`, insert the D1 ID and adjust the generated Worker asset paths if the build target changes them.
3. Apply the schema and FTS triggers:

   ```sh
   bunx wrangler d1 migrations apply tender-atlas --remote
   ```

4. Set `VITE_SITE_URL` to the public HTTPS origin and deploy the TanStack Start Cloudflare build using the owner's normal Worker deployment.
5. Trigger `POST /api/public/ingest` with `Authorization: Bearer $CRON_SECRET` once, or wait for the scheduled ingestion. Stored search activates automatically when fresh records exist; until then the live adapters remain available.

The two cron expressions in the example run ingestion every six hours and confirmed alert digests daily.

## Configuration

Secrets are set with `bunx wrangler secret put NAME`; never commit them.

| Variable | Purpose |
| --- | --- |
| `SAM_GOV_API_KEY` | SAM.gov search and detail records |
| `CRON_SECRET` | Manual ingestion endpoint |
| `TURNSTILE_SECRET_KEY` | Server verification for public forms |
| `RESEND_API_KEY` | Verification, digest and notification email |
| `STRIPE_SECRET_KEY` | Owner-managed Stripe Checkout |
| `STRIPE_PRICE_ID` | Server-selected dossier price |
| `STRIPE_WEBHOOK_SECRET` | Signed payment webhook verification |

Public/plain settings:

- `VITE_TURNSTILE_SITE_KEY`: browser Turnstile widget
- `NOTIFICATION_FROM_EMAIL`: verified Resend sender
- `NOTIFICATION_TO_EMAIL`: optional dossier-request recipient
- `VITE_STRIPE_ENABLED=true`: show the checkout action after a dossier request
- `VITE_SITE_URL`: canonical, sitemap, feed and email-link origin

Configure the Stripe webhook for `POST /api/public/stripe/webhook` and the `checkout.session.completed` event. Dossier requests and alerts return an honest unavailable response until their required owner settings exist.

## Data rules

- Missing fields are “not disclosed”, never inferred.
- Publisher amounts remain authoritative. EUR values are indicative ECB conversions.
- Cross-source records merge only on exact normalised buyer, title, country and deadline; related official records stay linked.
- Sitemap `lastmod` values come only from each notice's publisher update/publication date.
- Faceted search pages remain noindex; country/category/hub pages require at least five results for indexing.
