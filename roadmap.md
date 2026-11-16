# TenderAtlas roadmap

## Full directory upgrade
- [ ] Persistent Cloudflare D1 schema, incremental scheduled ingestion, fast indexed search, and live-source fallback
- [ ] Internal detail pages for all six sources, cross-source reconciliation, and uncapped pagination
- [ ] Dynamic notice sitemaps, country × CPV hubs, richer structured data, and social cards
- [ ] Value/deadline filters, EUR normalization, document manifests, and fast search UX
- [ ] Web dossier intake with spam protection, interactive sample dossier, and optional email delivery
- [ ] RSS/search alerts, buyer directory/profiles, and optional owner-managed Stripe checkout
- [ ] Automated tests plus browser verification of primary flows

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
