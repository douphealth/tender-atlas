<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Dossier orders use an owner-managed Stripe REST adapter in `src/lib/dossier`, a migrated D1 order queue and private hashed capability tokens; validate prices and official notice data server-side and mark paid only from matching signed events, because browser redirects and intake IDs are not proof of payment.
- Keep the app independent: no Lovable Cloud, Supabase or Lovable AI gateway; official publisher adapters live in `src/lib/procurement/sources.ts` and the owner deploys on their own Cloudflare account.
- Use Cloudflare D1 (`migrations/0001_directory.sql`, `src/lib/procurement/store.ts`) for the optional stored archive and fall back to live official-source search when it is absent or stale; never simulate stored data.
- Never infer missing notice fields; show them as "not disclosed" — accuracy is the product.
- Every source has an internal detail page; direct publisher links remain the authoritative record.
- The sitemap is built from D1, stored in `site_cache` and rebuilt after each ingest (`src/lib/procurement/sitemap.ts`). When D1 fails it serves the last good copy or 503, never a shorter sitemap; and while D1 fails, tender, listing and buyer pages answer 503 instead of 404 or noindex (`src/lib/outage-guard.ts`). Keep both: an empty result must never stand in for a failed query.
- D1 rows read and written are capped per day on the free plan, across every database on the account, and when the cap is hit the site answers 503. Read the archive through `sharedCached(..., STORED_TTL)` (`src/lib/procurement/cache.ts`), never per request; keep `upsertNotices` from rewriting unchanged rows; keep `Disallow: /tenders?` in robots.txt.
- Faceted /tenders URLs are noindex with canonical /tenders; country/CPV/country-CPV pages are noindex under 5 results — prevents thin/duplicate pages.
- Saved tenders and searches stay in browser localStorage (`src/lib/workspace.ts`) until real accounts exist; dossier requests and confirmed alerts use owner-managed Cloudflare D1.
