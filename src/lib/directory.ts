import { createServerFn } from "@tanstack/react-start";
import { cfBinding } from "@/lib/cf-env";
import { cached, sharedCached, STORED_TTL } from "./procurement/cache";
import { listStoredBuyers, storedBuyer, type AtlasEnv, type BuyerProfile, type BuyerSummary } from "./procurement/store";
import { collect } from "./procurement/sources";
import { buyerSlug } from "./procurement/reconcile";

const env = (): AtlasEnv => ({ SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"], DB: cfBinding("DB") as unknown as AtlasEnv["DB"] });

async function liveBuyers(): Promise<BuyerSummary[]> {
  const result = await cached("buyers:live", 15 * 60_000, () => collect({ q: "", source: "all", country: "", days: 7, page: 1, cpv: "", deadline: "any" }, env(), ["ted", "fr", "wb"]));
  const groups = new Map<string, BuyerSummary>();
  for (const n of result.items) {
    if (!n.buyer) continue;
    const slug = buyerSlug(n.buyer);
    const current = groups.get(slug) ?? { slug, name: n.buyer, count: 0, open: 0, countries: 0 };
    current.count++;
    if (n.status === "open") current.open++;
    groups.set(slug, current);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

export const getBuyers = createServerFn({ method: "GET" }).handler(async () => {
  // A whole-table GROUP BY: read once per data centre between ingests, not on every crawler hit. A failed read
  // (null) is retried after a minute.
  const stored = await sharedCached<BuyerSummary[] | null>("buyers:stored", (v) => (v ? STORED_TTL : 60), () => listStoredBuyers(env().DB));
  return { items: stored ?? await liveBuyers(), storage: stored ? "database" as const : "live" as const };
});

export const getBuyer = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input.slug).slice(0, 100) }))
  .handler(async ({ data }): Promise<{ profile: BuyerProfile | null; storage: "database" | "live" }> => {
    const stored = await sharedCached<BuyerProfile | null>(`buyer:stored:${data.slug}`, (v) => (v ? STORED_TTL : 60), () => storedBuyer(data.slug, env().DB));
    if (stored) return { profile: stored, storage: "database" };
    const buyers = await liveBuyers();
    const summary = buyers.find((b) => b.slug === data.slug);
    if (!summary) return { profile: null, storage: "live" };
    const result = await cached(`buyer:${data.slug}`, 15 * 60_000, () => collect({ q: summary.name, source: "all", country: "", days: 30, page: 1, cpv: "", deadline: "any" }, env(), ["ted", "fr", "wb"]));
    const notices = result.items.filter((n) => n.buyer && buyerSlug(n.buyer) === data.slug);
    return { profile: { ...summary, notices, categories: [], disclosedValueEur: null }, storage: "live" };
  });
