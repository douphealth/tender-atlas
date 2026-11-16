import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { COUNTRIES, SOURCES, SOURCE_KEYS } from "@/lib/procurement/catalog";

export type TenderSearch = { q?: string | undefined; source?: string | undefined; country?: string | undefined; days?: number | undefined; cpv?: string | undefined; page?: number | undefined };

export function SearchForm({ initial = {}, compact }: { initial?: TenderSearch; compact?: boolean }) {
  const navigate = useNavigate();
  const [f, setF] = useState<TenderSearch>({ days: 30, source: "all", ...initial });
  const set = (k: keyof TenderSearch) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const field = "h-11 rounded-sm border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const search: TenderSearch = { q: f.q || undefined, source: f.source !== "all" ? f.source : undefined, country: f.country || undefined, days: Number(f.days) !== 30 ? Number(f.days) : undefined, cpv: f.cpv || undefined };
        navigate({ to: "/tenders", search });
      }}
      className="grid gap-2 sm:grid-cols-[1fr_auto]"
    >
      <input aria-label="Keywords" placeholder="Keywords, e.g. road maintenance, cybersecurity…" value={f.q ?? ""} onChange={set("q")} className={`${field} w-full`} />
      <button className="h-11 rounded-sm bg-accent px-6 text-sm font-semibold text-accent-foreground hover:opacity-90">Search tenders</button>
      {!compact && (
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-4">
          <select aria-label="Source" value={f.source} onChange={set("source")} className={field}>
            <option value="all">All sources</option>
            {SOURCE_KEYS.map((k) => <option key={k} value={k}>{SOURCES[k].label}</option>)}
          </select>
          <select aria-label="Country" value={f.country ?? ""} onChange={set("country")} className={field}>
            <option value="">Any country</option>
            {[...COUNTRIES, { iso3: "GBR", name: "United Kingdom" }, { iso3: "USA", name: "United States" }].map((c) => <option key={c.iso3} value={c.iso3}>{c.name}</option>)}
          </select>
          <select aria-label="Published within" value={String(f.days)} onChange={set("days")} className={field}>
            {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <input aria-label="CPV code" placeholder="CPV e.g. 72000000" value={f.cpv ?? ""} onChange={set("cpv")} inputMode="numeric" className={field} />
        </div>
      )}
    </form>
  );
}
