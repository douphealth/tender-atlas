# TenderAtlas roadmap
- [x] Crawlable SSR pages, real sitemap.xml, 404s, 301s for old .html URLs
- [x] Public directory: /tenders, /tenders/{source}/{id}, /countries/{code}/tenders, /cpv/{code}
- [x] Live adapters for TED, BOAMP, World Bank, KIMDIS, Find a Tender, SAM.gov (fixed World Bank date bug)
- [x] Local workspace: saved tenders, pipeline stages, notes, saved searches, calendar export
- [x] Dossier pilot request page (email-based)
- [ ] Contact email for dossier requests — waiting on owner (VITE_CONTACT_EMAIL)
- [ ] SAM.gov key — owner sets SAM_GOV_API_KEY on their Cloudflare project
- [ ] Stored ingestion database, accounts, email alerts, Stripe billing — need owner's own Cloudflare D1/email/Stripe accounts
- [ ] /buyers/{id} pages — need stored history to be meaningful
