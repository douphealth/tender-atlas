# Staging → Production acceptance gates

1. [ ] GitHub `main` CI completed successfully and Cloudflare Pages build succeeded (no startup failure).
2. [ ] `/api/health` feature flags match the installed bindings and variables.
3. [ ] TED live sample request returns real notices whose IDs exist on ted.europa.eu; verify dates/CPV/value/links on 10 sampled notices.
4. [ ] ΚΗΜΔΗΣ live sample returns real ADAM numbers; ensure canceled notices remain labeled and estimated amounts match official documents.
5. [ ] UK OCDS sample parsed; label the feed as a recent-page subset, never comprehensive UK search.
6. [ ] Source downtime results in visible partial failures, no fabricated or stale results silently shown as fresh.
7. [ ] No expired notice labeled guaranteed open; verify multiple lots/amendments manually.
8. [ ] User OTP is delivered to verified addresses; resend throttling, incorrect codes and logout work.
9. [ ] Confirm separate Cloudflare D1 resources for preview and production; test backups and migration recovery.
10. [ ] Free watchlist cap 5 and alert cap 1 enforced server-side; paid quotas enforced server-side.
11. [ ] Stripe **test-mode** trial, payment, renewal, failed payment, duplicate webhook, cancel, reactivation and plan migration validated.
12. [ ] AI BGE-M3 returns vectors with expected shape in live Cloudflare runtime; quotas and invalid input tested.
13. [ ] Scheduled job works and email deliveries are deduplicated, source errors logged, provider quotas monitored.
14. [ ] Desktop/mobile browser smoke, Core Web Vitals and keyboard navigation verified in deployed URL.
15. [ ] Operator identity, privacy policy, terms, VAT/refund terms, support contact and data source attributions are published.
16. [ ] Restore plan documented and deployed. Production live-payments feature enabled only after all gates pass.
