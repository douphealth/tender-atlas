# Staging → Production acceptance gates

1. [ ] GitHub staging PR CI completed successfully and Cloudflare Pages build succeeded (no startup failure).
2. [ ] `/api/health` feature flags match the installed bindings and variables.
3. [ ] TED live sample request returns real notices whose IDs exist on ted.europa.eu; verify dates/CPV/value/links on 10 sampled notices.
4. [ ] ΚΗΜΔΗΣ live sample returns real ADAM numbers; ensure canceled notices remain labeled and estimated amounts match official documents.
5. [ ] UK OCDS sample parsed; label the feed as a recent-page subset, never comprehensive UK search.
6. [ ] Source downtime results in visible partial failures, no fabricated or stale results silently shown as fresh.
7. [ ] No expired notice labeled guaranteed open; verify multiple lots/amendments manually.
8. [ ] User OTP is delivered to verified addresses; resend throttling, incorrect codes and logout work.
9. [ ] Confirm separate Cloudflare D1 resources for preview and production; test backups and migration recovery.
10. [ ] Guest device bookmarks persist with clear local-only labeling; account Free watchlist cap 5 and alert cap 1 enforced server-side; paid quotas enforced server-side.
11. [ ] Stripe **test-mode** trial, payment, renewal, failed payment, duplicate webhook, cancel, reactivation and plan migration validated.
12. [ ] AI BGE-M3 returns vectors with expected shape in live Cloudflare runtime; quotas and invalid input tested.
13. [ ] Scheduled job works and email deliveries are deduplicated, source errors logged, provider quotas monitored.
14. [ ] Desktop/mobile browser smoke, Core Web Vitals and keyboard navigation verified in deployed URL.
15. [ ] Operator identity, privacy policy, terms, VAT/refund terms, support contact and data source attributions are published.
16. [ ] Restore plan documented and deployed. Production live-payments feature enabled only after all gates pass.

## v1.1 additional safeguards

17. [ ] Verify live TED query including additional notice types against the official query validator; if rejected, revert only the new query expression.
18. [ ] Verify ΚΗΜΔΗΣ exact PDF attachment links and localized `objectDetails[].cpvs[].key` on at least five real entries.
19. [ ] Verify UK three-page cursor scan within expected latency/rate limits; source may return 403/429 or reduced coverage.
20. [ ] Confirm US source stays off without an API key and never exposes credentials in page HTML, search JSON, errors or logs.
21. [ ] Check guest bookmarks, export CSV, copy-search, filter/sort, source error banner and desktop/mobile keyboard accessibility.
22. [ ] Check CSP: no inline JS is required and market breakdown uses native `<progress>` elements instead of CSP-blocked inline styles.
23. [ ] Never present test or screenshot fixtures as real notices. Live network source tests and Stripe payment tests must be run separately.

## v2.2 interface and source checks

24. [ ] Open live preview in desktop and 390px mobile viewport; verify real notices appear without horizontal overflow and the mobile filter drawer works.
25. [ ] Ensure every chart and evidence bar renders under the strict `style-src 'self'` CSP (no inline styles).
26. [ ] Confirm decision desk uses actual future-deadline notices or transparent local profile scores, never invented tenders or eligibility statements.
27. [ ] Verify UK feed stops within its latency budget, reports truncated coverage, and never discards previously fetched pages when a subsequent page times out.
28. [ ] Confirm main remains available and existing D1, Stripe or email runtime settings are not modified by this visual/data release.
