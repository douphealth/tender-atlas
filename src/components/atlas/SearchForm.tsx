import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { COUNTRIES, SOURCES, SOURCE_KEYS } from "@/lib/procurement/catalog";

export type TenderSearch = {
  q?: string | undefined; source?: string | undefined; country?: string | undefined; days?: number | undefined;
  cpv?: string | undefined; page?: number | undefined; deadline?: "any" | "48h" | "7d" | undefined;
  minValueEur?: number | undefined; maxValueEur?: number | undefined;
};

export function SearchForm({ initial = {}, compact }: { initial?: TenderSearch; compact?: boolean }) {
  const navigate = useNavigate();
  const [f, setF] = useState<TenderSearch>({ days: 30, source: "all", deadline: "any", ...initial });
  const set = (k: keyof TenderSearch) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const field = "h-11 rounded-sm border border-input bg-card px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20";
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const amount = (v: number | undefined) => v != null && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : undefined;
        const search: TenderSearch = {
          q: f.q || undefined, source: f.source !== "all" ? f.source : undefined, country: f.country || undefined,
          days: Number(f.days) !== 30 ? Number(f.days) : undefined, cpv: f.cpv || undefined,
          deadline: f.deadline !== "any" ? f.deadline : undefined,
          minValueEur: amount(f.minValueEur), maxValueEur: amount(f.maxValueEur),
        };
        navigate({ to: "/tenders", search });
      }}
      className="grid gap-2 sm:grid-cols-[1fr_auto]"
    >
      <label className="sr-only" htmlFor="tender-keywords">Keywords</label>
      <input id="tender-keywords" placeholder="Keywords, buyer or service — e.g. road maintenance, cybersecurity…" value={f.q ?? ""} onChange={set("q")} className={`${field} w-full`} />
      <button className="h-11 rounded-sm bg-accent px-6 text-sm font-semibold text-accent-foreground transition hover:opacity-90">Search tenders</button>
      {!compact && (
        <div className="grid gap-3 sm:col-span-2">
          <div className="grid gap-2 sm:grid-cols-4">
            <select aria-label="Source" value={f.source} onChange={set("source")} className={field}>
              <option value="all">All sources</option>
              {SOURCE_KEYS.map((k) => <option key={k} value={k}>{SOURCES[k].label}</option>)}
            </select>
            <select aria-label="Country" value={f.country ?? ""} onChange={set("country")} className={field}>
              <option value="">Any country</option>
              {COUNTRIES.map((c) => <option key={c.iso3} value={c.iso3}>{c.name}</option>)}
            </select>
            <select aria-label="Published within" value={String(f.days)} onChange={set("days")} className={field}>
              {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
            </select>
            <input aria-label="CPV code" placeholder="CPV e.g. 72000000" value={f.cpv ?? ""} onChange={set("cpv")} inputMode="numeric" className={field} />
          </div>
          <div className="grid gap-2 rounded-md border border-border bg-secondary/50 p-3 sm:grid-cols-[1.4fr_1fr_1fr]">
            <select aria-label="Deadline" value={f.deadline ?? "any"} onChange={set("deadline")} className={field}>
              <option value="any">Any deadline</option><option value="48h">Closing within 48 hours</option><option value="7d">Closing within 7 days</option>
            </select>
            <input aria-label="Minimum value in EUR" type="number" min="0" step="1000" placeholder="Min value (EUR)" value={f.minValueEur ?? ""} onChange={set("minValueEur")} className={field} />
            <input aria-label="Maximum value in EUR" type="number" min="0" step="1000" placeholder="Max value (EUR)" value={f.maxValueEur ?? ""} onChange={set("maxValueEur")} className={field} />
            <p className="text-xs text-muted-foreground sm:col-span-3">Value filters use indicative ECB euro conversions. The original publisher amount remains authoritative.</p>
          </div>
        </div>
      )}
    </form>
  );
}
