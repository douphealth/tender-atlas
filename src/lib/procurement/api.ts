import { createServerFn } from "@tanstack/react-start";
import { cfBinding } from "@/lib/cf-env";
import { cached, sharedCached } from "./cache";
import { fetchNotice, parseSearch, type SearchResult } from "./sources";
import type { SourceKey } from "./catalog";
import { relatedStored, resolveNotice, searchWithStore, type AtlasEnv } from "./store";

const env = (): AtlasEnv => ({
  SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"],
  DB: cfBinding("DB") as unknown as AtlasEnv["DB"],
});

export const searchTenders = createServerFn({ method: "GET" })
  .inputValidator((input: Record<string, unknown> & { only?: SourceKey[] }) => input)
  .handler(async ({ data }): Promise<SearchResult> => {
    const p = parseSearch(data);
    const only = Array.isArray(data.only) ? data.only : undefined;
    return sharedCached(`s:${JSON.stringify(p)}:${only?.join(",") ?? ""}`, 10 * 60, () => searchWithStore(p, env(), only));
  });

export const getTender = createServerFn({ method: "GET" })
  .inputValidator((input: { source: string; id: string }) => ({ source: String(input.source), id: String(input.id).slice(0, 160) }))
  .handler(async ({ data }) => {
    const environment = env();
    // A real notice is remembered for thirty minutes and a firm "not found" for one (enough to stop repeat
    // lookups of a bad id). A miss while the database could not be asked is not remembered at all: the notice
    // may well be stored, and the page must come back the moment the database does.
    const found = await cached(`n:${data.source}:${data.id}`, (v) => (v.notice ? 30 * 60_000 : v.known ? 60_000 : 0),
      () => resolveNotice(data.source, data.id, () => fetchNotice(data.source, data.id, environment), environment.DB));
    return found.notice;
  });

/** Related stored notices for a tender page (same buyer, then same country + CPV division). */
export const getRelatedTenders = createServerFn({ method: "GET" })
  .inputValidator((input: { source: string; noticeId: string; buyer: string | null; country: string | null; cpv: string[] }) => ({
    source: String(input.source), noticeId: String(input.noticeId).slice(0, 160), buyer: input.buyer ? String(input.buyer).slice(0, 300) : null,
    country: input.country ? String(input.country).slice(0, 3) : null, cpv: Array.isArray(input.cpv) ? input.cpv.slice(0, 5).map(String) : [],
  }))
  .handler(async ({ data }) => cached(`r:${data.source}:${data.noticeId}`, 30 * 60_000, () => relatedStored(data, env().DB)));
