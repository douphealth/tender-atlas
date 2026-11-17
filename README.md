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

4. The canonical origin defaults to `https://tenderatlas.shop`. Set `VITE_SITE_URL` only to override it. A `pages.dev` value is ignored so preview hosts cannot leak into canonicals, the sitemap or JSON-LD. Deploy the TanStack Start Cloudflare build using the owner's normal Worker deployment.
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
- `DOSSIER_SALES_OPEN=true`: explicitly open tender-specific paid bookings after confirming delivery capacity (default: closed)
- `VITE_SITE_URL`: optional override for the canonical, sitemap, feed and email-link origin. Default: `https://tenderatlas.shop`. `*.pages.dev` is rejected.

Configure the Stripe webhook for `POST /api/public/stripe/webhook`, `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Apply all migrations, including `0002_dossier_orders.sql`. Dossier requests and alerts return an honest unavailable response until their required owner settings exist.

## Dossier pilot activation and delivery

- The delegated pilot offer is €290 before tax, one tender/one lot and up to 150 pages; two working days after complete document access. Sales remain closed until the owner can honour this and the full-refund policy.
- Create an active, one-time EUR Stripe price of **29000 cents**, exclusive of tax. Set its product's appropriate Stripe Tax code for the actual human-delivered document-review service, configure tax registrations and Stripe Tax, then set `STRIPE_PRICE_ID`. The adapter uses `automatic_tax`, not merchant-of-record handling; the owner remains responsible for tax registration, filing and remittance.
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, D1, Turnstile, production `VITE_SITE_URL` and notification settings before opening sales. Test checkout, signed events, delayed payments, cancellations and refunds on the owner's Stripe test account first. No payment integration is connected through Lovable.
- Only open competitions with a disclosed deadline more than four calendar days away can book; other tenders take the prefilled scope-review path. This is a safety buffer, not a calculated delivery guarantee before the bid deadline.
- Checkout re-fetches the official notice, stores its snapshot and agreed offer, validates the Stripe price, and uses stable idempotency parameters. The browser's private order token stays in sessionStorage; D1 stores only its hash. A redirected browser never marks an order paid.
- Signed matching paid sessions enter `dossier_requests.status='paid-queue'`; `dossier_orders` holds scope/context and payment evidence. Monitor this queue even if email is unavailable. Failed owner notification makes Stripe retry; no automatic dossier generation or automatic file delivery is implemented.
- On each paid order, confirm the selected lot and document access with the customer, record the review cutoff and delivery due date, read the full documents and amendments, cite document/page/section for every requirement, distinguish facts from interpretation, flag contradictions and unknowns, and quality-check the dossier. Deliver PDF plus editable checklist to the recorded email. Refund through Stripe if access or agreed scope cannot be delivered; refunds are an owner operation, not automatic.
- Purge abandoned unpaid orders under the owner's privacy/retention policy; never put payment keys or customer details into public logs. Capacity, tax compliance, fulfilment and retention remain owner responsibilities.

## Data rules

- Missing fields are “not disclosed”, never inferred.
- Publisher amounts remain authoritative. EUR values are indicative ECB conversions.
- Cross-source records merge only on exact normalised buyer, title, country and deadline; related official records stay linked.
- Sitemap `lastmod` values come only from each notice's publisher update/publication date.
- Faceted search pages remain noindex; country/category/hub pages require at least five results for indexing.

## IndexNow

The public IndexNow key file is `/6541e36054ab20cf0850f67f4db053df.txt` (the file body is the key). After deployment, the owner can ping Bing or Yandex with key location `https://tenderatlas.shop/6541e36054ab20cf0850f67f4db053df.txt`.
