import { Link } from "@tanstack/react-router";
import { SOURCES, countryByIso3 } from "@/lib/procurement/catalog";
import type { Notice, SearchResult } from "@/lib/procurement/sources";
import { daysLeft, fmtDate, fmtMoney } from "./format";

export function StatusPill({ n }: { n: Notice }) {
  const left = daysLeft(n.deadlineAt);
  const label = n.status === "awarded" ? "Awarded" : n.status === "cancelled" ? "Cancelled" : n.status === "deadline-passed" ? "Deadline passed"
    : left != null ? (left <= 0 ? "Closes today" : `${left} day${left === 1 ? "" : "s"} left`) : n.stage === "planning" ? "Planning" : "Deadline unknown";
  const tone = n.status === "open" && left != null && left <= 7 ? "bg-accent text-accent-foreground"
    : n.status === "open" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex shrink-0 items-center rounded-sm px-2 py-0.5 font-mono text-[11px] ${tone}`}>{label}</span>;
}

function TitleLink({ n }: { n: Notice }) {
  const cls = "font-medium text-foreground decoration-accent underline-offset-4 hover:underline";
  if (SOURCES[n.source].detailPages)
    return <Link to="/tenders/$source/$id" params={{ source: n.source, id: n.noticeId }} className={cls}>{n.title}</Link>;
  return <a href={n.url ?? "#"} target="_blank" rel="noopener noreferrer" className={cls}>{n.title} <span aria-hidden>↗</span></a>;
}

export function TenderList({ items, empty }: { items: Notice[]; empty?: string }) {
  if (!items.length) return <p className="rounded-md border border-dashed border-border p-8 text-center text-muted-foreground">{empty ?? "No notices matched."}</p>;
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
      {items.map((n) => {
        const money = fmtMoney(n.value, n.currency);
        const country = countryByIso3(n.country)?.name ?? n.countryName ?? n.country;
        return (
          <li key={n.id} className="grid gap-1.5 p-4 sm:grid-cols-[1fr_auto] sm:gap-6">
            <div className="min-w-0">
              <TitleLink n={n} />
              <p className="mt-1 truncate text-sm text-muted-foreground">{n.buyer ?? "Buyer not disclosed"}{country ? ` · ${country}` : ""}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {SOURCES[n.source].label} · {n.noticeId} · published {fmtDate(n.publishedAt)}{n.cpv[0] ? ` · CPV ${n.cpv[0]}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:justify-center">
              <StatusPill n={n} />
              {money && <span className="font-mono text-sm">{money}</span>}
              {n.deadlineAt && <span className="text-xs text-muted-foreground">Due {fmtDate(n.deadlineAt)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function SourceHealth({ result }: { result: SearchResult }) {
  const entries = Object.entries(result.health);
  if (!entries.length) return null;
  return (
    <details className="rounded-md border border-border bg-card p-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        {result.items.length} notices from {entries.filter(([, h]) => h?.status === "ok").length}/{entries.length} sources · fetched live {new Date(result.fetchedAt).toUTCString().slice(17, 22)} UTC
      </summary>
      <ul className="mt-3 grid gap-1.5 font-mono text-xs sm:grid-cols-2">
        {entries.map(([k, h]) => (
          <li key={k} className="flex justify-between gap-2">
            <span>{SOURCES[k as keyof typeof SOURCES].label}</span>
            <span className={h?.status === "ok" ? "text-success" : "text-muted-foreground"}>
              {h?.status === "ok" ? `${h.count} shown${h.total ? ` of ${h.total.toLocaleString()}` : ""} · ${h.latencyMs}ms` : `${h?.status}${h?.message ? `: ${h.message}` : ""}`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
