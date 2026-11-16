# TenderAtlas roadmap

## In-context dossier ordering
- [x] Tender-specific offer, document-backed deliverables, scope, and checkout form
- [x] Server-validated Stripe price, protected/idempotent orders, and verified payment status
- [x] Signed webhook fulfilment queue and owner handoff implemented; 44 automated checks and real tender/mobile/prefill browser checks passed
- [ ] Live activation and real payment verification: blocked on owner Stripe/D1/Turnstile/email configuration and delivery capacity confirmation; dossier preparation, file delivery and refunds remain owner-operated

## Full directory upgrade
- [x] Persistent Cloudflare D1 schema, incremental scheduled ingestion, fast indexed search, and live-source fallback
- [x] Internal detail pages for all six sources, cross-source reconciliation, and uncapped pagination
- [x] Dynamic notice sitemaps, country × CPV hubs, richer structured data, and social cards
- [x] Value/deadline filters, EUR normalization, document manifests, and fast search UX
- [x] Web dossier intake with spam protection, interactive sample dossier, and optional email delivery
- [x] RSS/search alerts, buyer directory/profiles, and optional owner-managed Stripe checkout
- [x] Automated tests plus browser verification of primary flows

## Owner configuration (code should degrade honestly until supplied)
- [ ] Contact/notification email and Cloudflare Turnstile keys
- [ ] SAM.gov API key
- [ ] Cloudflare D1 binding and scheduled-worker deployment
- [ ] Stripe secret key, price ID, and webhook secret

## Completed foundation
- [x] Crawlable SSR pages, real sitemap.xml, 404s, 301s for old .html URLs
- [x] Public directory: /tenders, /tenders/{source}/{id}, /countries/{code}/tenders, /cpv/{code}
- [x] Live adapters for TED, BOAMP, World Bank, KIMDIS, Find a Tender, SAM.gov
- [x] Local workspace: saved tenders, pipeline stages, notes, saved searches, calendar export
- [x] Dossier pilot request page
