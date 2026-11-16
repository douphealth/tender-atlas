import { createServerFn } from "@tanstack/react-start";
import { cached } from "./cache";
import { collect, fetchNotice, parseSearch, type SearchResult } from "./sources";
import type { SourceKey } from "./catalog";

const env = () => ({ SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"] });

export const searchTenders = createServerFn({ method: "GET" })
  .inputValidator((input: Record<string, unknown> & { only?: SourceKey[] }) => input)
  .handler(async ({ data }): Promise<SearchResult> => {
    const p = parseSearch(data);
    const only = Array.isArray(data.only) ? data.only : undefined;
    return cached(`s:${JSON.stringify(p)}:${only?.join(",") ?? ""}`, 5 * 60_000, () => collect(p, env(), only));
  });

export const getTender = createServerFn({ method: "GET" })
  .inputValidator((input: { source: string; id: string }) => ({ source: String(input.source), id: String(input.id).slice(0, 80) }))
  .handler(async ({ data }) => {
    const n = await cached(`n:${data.source}:${data.id}`, 30 * 60_000, () => fetchNotice(data.source, data.id));
    return n;
  });
