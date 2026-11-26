import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, BellRing, FileCheck2, Link2, Radio, ShieldCheck } from "lucide-react";
import { searchTenders } from "@/lib/procurement/api";
import { COUNTRIES, CPV_DIVISIONS, SOURCES, SOURCE_KEYS, countryByIso3 } from "@/lib/procurement/catalog";
import { TenderList, SourceHealth } from "@/components/atlas/TenderList";
import { SearchForm } from "@/components/atlas/SearchForm";
import { daysLeft } from "@/components/atlas/format";
import { pageHead } from "@/lib/seo";
import { abs } from "@/lib/site";

export const Route = createFileRoute("/")({
  loader: () => searchTenders({ data: { days: 7, only: ["ted", "fr", "wb"] } }),
  head: () => pageHead({
    title: "TenderAtlas — Live public tenders from official procurement sources",
    description: "Find open public tenders across Europe, the UK, France, Greece, the US and World Bank projects. Every notice links to its official publisher.",
    path: "/",
    jsonLd: { "@context": "https://schema.org", "@type": "WebSite", name: "TenderAtlas", url: abs("/"), potentialAction: { "@type": "SearchAction", target: abs("/tenders?q={q}"), "query-input": "required name=q" } },
  }),
  component: Home,
});

const POPULAR_CPV = ["45000000", "72000000", "33000000", "71000000", "90000000", "79000000", "48000000", "34000000"];
const QUICK_SEARCHES = ["road maintenance", "cybersecurity", "medical equipment", "cleaning services", "software development"];
const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });

const PRINCIPLES = [
  { icon: Radio, title: "Read at source", body: "Notices come straight from the official publisher's own feed, not from a scraped copy." },
  { icon: Link2, title: "Every record linked", body: "Each notice links back to the original, so you can check it before you rely on it." },
  { icon: ShieldCheck, title: "Nothing invented", body: "No guessed eligibility or scores. If a publisher leaves a field out, we say so." },
];

function Home() {
  const data = Route.useLoaderData();
  const items = data.items;
  const openAll = items.filter((n) => n.status === "open");
  const open = openAll.slice(0, 12);

  // Everything in the live register panel is counted from the notices this page just loaded.
  const closing = openAll
    .map((n) => ({ n, left: daysLeft(n.deadlineAt) }))
    .filter((x): x is { n: (typeof openAll)[number]; left: number } => x.left != null && x.left >= 0)
    .sort((a, b) => a.left - b.left);
  const within7 = closing.filter((x) => x.left <= 7).length;
  const countryCount = new Map<string, number>();
  const cpvCount = new Map<string, number>();
  let valueEur = 0;
  let withValue = 0;
  for (const n of items) {
    if (n.country) countryCount.set(n.country, (countryCount.get(n.country) ?? 0) + 1);
    const div = n.cpv[0]?.slice(0, 2);
    if (div) cpvCount.set(div, (cpvCount.get(div) ?? 0) + 1);
    const eur = n.valueEur ?? (n.currency === "EUR" ? n.value : null);
    if (eur != null && eur > 0) { valueEur += eur; withValue++; }
  }
  const health = Object.values(data.health);
  const responding = health.filter((h) => h?.status === "ok").length;
  const retrieved = new Date(data.fetchedAt).toISOString().slice(11, 16);

  const stats = [
    { value: items.length, label: "notices read", sub: "published in the last 7 days" },
    { value: openAll.length, label: "open for bids", sub: "deadline not yet passed" },
    { value: within7, label: "closing soon", sub: "due within 7 days" },
    { value: countryCount.size, label: "countries", sub: "in this week's notices" },
  ];

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="grid-paper pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_92%)]" />
        <div aria-hidden className="hero-wash pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-10">
          <div className="min-w-0">
            <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 backdrop-blur">
              <span className="live-dot" aria-hidden />
              Public procurement · read at source
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.04] text-primary sm:text-6xl lg:text-[4.1rem]">
              Every public tender, traced back to the <em className="text-accent">official notice</em>.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
              TenderAtlas queries {SOURCE_KEYS.length} government and multilateral publishers live. No scraped copies, no invented eligibility — just the record and a link to the original.
            </p>
            <div className="mt-8 max-w-2xl rounded-lg border border-border bg-card/90 p-2 shadow-[0_18px_40px_-28px_var(--ink-deep)] backdrop-blur">
              <SearchForm compact />
            </div>
            <ul className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <li className="eyebrow mr-1">Try</li>
              {QUICK_SEARCHES.map((q) => (
                <li key={q}>
                  <Link to="/tenders" search={{ q }} className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-muted-foreground transition hover:border-accent hover:text-accent">
                    {q}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Live register: real counts from this page load */}
          <aside aria-label="Live register summary" className="ledger panel-rise relative min-w-0 overflow-hidden rounded-xl p-6 text-primary-foreground sm:p-7">
            <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute -right-14 -top-14 h-56 w-56 text-primary-foreground/10" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="100" cy="100" r="90" />
              <ellipse cx="100" cy="100" rx="90" ry="34" />
              <ellipse cx="100" cy="100" rx="90" ry="66" />
              <ellipse cx="100" cy="100" rx="34" ry="90" />
              <ellipse cx="100" cy="100" rx="66" ry="90" />
              <path d="M10 100h180M100 10v180" />
            </svg>
            <div className="relative flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-primary-foreground/70">
                <span className="live-dot" aria-hidden />
                Live register
              </p>
              <p className="font-mono text-[11px] text-primary-foreground/60">Retrieved {retrieved} UTC</p>
            </div>

            {items.length ? (
              <>
                <dl className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-primary-foreground/10">
                  {stats.map((s) => (
                    <div key={s.label} className="bg-[oklch(0.23_0.05_255)] p-4">
                      <dd className="font-display text-4xl font-semibold leading-none tabular-nums">{s.value.toLocaleString("en-GB")}</dd>
                      <dt className="mt-2 text-sm font-medium">{s.label}</dt>
                      <dd className="mt-0.5 text-[11px] text-primary-foreground/55">{s.sub}</dd>
                    </div>
                  ))}
                </dl>
                {withValue > 0 && (
                  <p className="relative mt-4 text-sm text-primary-foreground/75">
                    <span className="font-mono text-base font-semibold text-primary-foreground">€{compact.format(valueEur)}</span> stated across the {withValue.toLocaleString("en-GB")} notices that publish a value <span className="text-primary-foreground/55">(indicative ECB conversion)</span>.
                  </p>
                )}
                {closing.length > 0 && (
                  <div className="relative mt-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary-foreground/60">Closing soonest</p>
                    <ol className="mt-2 divide-y divide-primary-foreground/10">
                      {closing.slice(0, 3).map(({ n, left }) => (
                        <li key={n.id} className="py-2.5">
                          <Link to="/tenders/$source/$id" params={{ source: n.source, id: n.noticeId }} className="group flex items-start gap-3">
                            <span className="mt-0.5 shrink-0 rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[11px] text-accent-foreground">{left === 0 ? "today" : `${left}d`}</span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-1 text-sm font-medium decoration-accent underline-offset-4 group-hover:underline">{n.title}</span>
                              <span className="block truncate text-[11px] text-primary-foreground/55">{countryByIso3(n.country)?.name ?? n.countryName ?? n.country ?? "Country not stated"} · {SOURCES[n.source].label}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            ) : (
              <p className="relative mt-6 rounded-lg border border-dashed border-primary-foreground/25 p-5 text-sm text-primary-foreground/75">No publisher responded just now. The full search retries every source.</p>
            )}

            <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-primary-foreground/10 pt-4 text-[12px]">
              <span className="text-primary-foreground/60">{responding} of {health.length} sources responding</span>
              <Link to="/methodology" className="inline-flex items-center gap-1 font-medium text-primary-foreground hover:text-accent">
                How we read them <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* ---------- Principles ---------- */}
      <section className="border-b border-border bg-card">
        <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-px bg-border sm:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3 bg-card px-4 py-6 sm:px-6">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent/10 text-accent"><Icon className="h-4 w-4" aria-hidden /></span>
              <span>
                <span className="block font-display text-lg font-semibold leading-tight">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Open tenders ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Published in the last 7 days</p>
            <h2 className="mt-1 text-3xl font-semibold sm:text-4xl">Open for bids now</h2>
          </div>
          <Link to="/tenders" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent">
            Search all tenders <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-6 space-y-3">
          <TenderList items={open} empty="No publisher responded just now. Try the full search." />
          <SourceHealth result={data} />
        </div>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Common Procurement Vocabulary</p>
              <h2 className="mt-1 text-3xl font-semibold">Popular categories</h2>
            </div>
            <Link to="/cpv" className="text-sm font-medium text-accent hover:underline">All CPV divisions →</Link>
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POPULAR_CPV.map((code) => {
              const d = CPV_DIVISIONS.find((x) => x.code === code)!;
              const count = cpvCount.get(code.slice(0, 2)) ?? 0;
              return (
                <li key={code}>
                  <Link to="/cpv/$code" params={{ code }} className="lift group flex h-full flex-col rounded-lg border border-border bg-card p-5">
                    <span className="flex items-start justify-between">
                      <span className="font-display text-4xl font-semibold leading-none text-accent">{code.slice(0, 2)}</span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-accent" aria-hidden />
                    </span>
                    <span className="mt-4 text-sm font-medium leading-snug">{d.name}</span>
                    <span className="mt-auto pt-3 font-mono text-[11px] text-muted-foreground">
                      CPV {code}{count > 0 ? ` · ${count} this week` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------- Countries ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{COUNTRIES.length} country directories</p>
            <h2 className="mt-1 text-3xl font-semibold">Tenders by country</h2>
          </div>
          <Link to="/countries" className="text-sm font-medium text-accent hover:underline">Country overview →</Link>
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {COUNTRIES.map((c) => {
            const count = countryCount.get(c.iso3) ?? 0;
            return (
              <li key={c.iso2} className="min-w-0">
                <Link to="/countries/$code/tenders" params={{ code: c.iso2 }} className="lift group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
                  <span className="grid h-7 w-9 shrink-0 place-items-center rounded-sm bg-primary font-mono text-[11px] font-semibold uppercase text-primary-foreground transition group-hover:bg-accent">{c.iso2}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  {count > 0 && <span className="shrink-0 font-mono text-[11px] text-muted-foreground" title={`${count} in this week's notices`}>{count}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Numbers show how many of this week&apos;s loaded notices come from each country.</p>
      </section>

      {/* ---------- Sources ---------- */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="eyebrow">Official publishers</p>
          <h2 className="mt-1 text-3xl font-semibold">Sources we read</h2>
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCE_KEYS.map((k) => {
              const h = data.health[k];
              return (
                <div key={k} className="rounded-lg border border-border bg-background p-5">
                  <dt className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-accent">{SOURCES[k].label}</span>
                    {h?.status === "ok" && (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                        responding{h.latencyMs ? ` · ${h.latencyMs}ms` : ""}
                      </span>
                    )}
                  </dt>
                  <dd className="mt-2 text-sm font-medium leading-snug">{SOURCES[k].name}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">{SOURCES[k].region}</dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">Coverage is live and bounded, not a complete archive. <Link to="/methodology" className="underline">Read the methodology</Link>.</p>
        </div>
      </section>

      {/* ---------- Next steps ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link to="/pricing" className="ledger lift group relative overflow-hidden rounded-xl p-7 text-primary-foreground">
            <FileCheck2 className="h-6 w-6 text-accent" aria-hidden />
            <h2 className="mt-4 text-2xl font-semibold">Tender Readiness Dossiers</h2>
            <p className="mt-2 max-w-md text-sm text-primary-foreground/75">Document-backed bid/no-bid dossiers: mandatory requirements, risks and open questions, each cited to the page of the official tender documents.</p>
            <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
              <span className="font-mono">€290</span> one-off, no subscription <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
            </p>
          </Link>
          <Link to="/alerts" className="lift group rounded-xl border border-border bg-card p-7">
            <BellRing className="h-6 w-6 text-accent" aria-hidden />
            <h2 className="mt-4 text-2xl font-semibold">Never miss a matching notice</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Create a confirmed daily email digest, or subscribe to any live tender search by RSS.</p>
            <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">
              Set up alerts <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
            </p>
          </Link>
        </div>
      </section>
    </>
  );
}
