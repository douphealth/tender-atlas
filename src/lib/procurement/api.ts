import { createServerFn } from "@tanstack/react-start";
import { cfBinding } from "@/lib/cf-env";
import { cached } from "./cache";
import { fetchNotice, parseSearch, type SearchResult } from "./sources";
import type { SourceKey } from "./catalog";
import { searchWithStore, storedNotice, type AtlasEnv } from "./store";

const env = (): AtlasEnv => ({
  SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"],
  DB: cfBinding("DB") as unknown as AtlasEnv["DB"],
});

export const searchTenders = createServerFn({ method: "GET" })
  .inputValidator((input: Record<string, unknown> & { only?: SourceKey[] }) => input)
  .handler(async ({ data }): Promise<SearchResult> => {
    const p = parseSearch(data);
    const only = Array.isArray(data.only) ? data.only : undefined;
    return cached(`s:${JSON.stringify(p)}:${only?.join(",") ?? ""}`, 5 * 60_000, () => searchWithStore(p, env(), only));
  });

export const getTender = createServerFn({ method: "GET" })
  .inputValidator((input: { source: string; id: string }) => ({ source: String(input.source), id: String(input.id).slice(0, 160) }))
  .handler(async ({ data }) => {
    const environment = env();
    return cached(`n:${data.source}:${data.id}`, 30 * 60_000, async () => {
      const live = await fetchNotice(data.source, data.id, environment);
      return live ?? storedNotice(data.source, data.id, environment.DB);
    });
  });
