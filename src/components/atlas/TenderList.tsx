import { Link } from "@tanstack/react-router";
import { SOURCES, countryByIso3 } from "@/lib/procurement/catalog";
import type { Notice, SearchResult } from "@/lib/procurement/sources";
import { buyerSlug } from "@/lib/procurement/reconcile";
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
  return <Link to="/tenders/$source/$id" params={{ source: n.source, id: n.noticeId }} className="font-medium text-foreground decoration-accent underline-offset-4 hover:text-accent hover:underline">{n.title}</Link>;
}

export function TenderList({ items, empty }: { items: Notice[]; empty?: string }) {
  if (!items.length) return <p className="rounded-md border border-dashed border-border p-8 text-center text-muted-foreground">{empty ?? "No notices matched. Try fewer filters or a wider date range."}</p>;
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
      {items.map((n) => {
        const money = fmtMoney(n.value, n.currency);
        const country = countryByIso3(n.country)?.name ?? n.countryName ?? n.country;
        return (
          <li key={n.id} className="group grid gap-1.5 p-4 transition hover:bg-secondary/45 sm:grid-cols-[1fr_auto] sm:gap-6 sm:p-5">
            <div className="min-w-0">
              <TitleLink n={n} />
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {n.buyer ? <Link to="/buyers/$slug" params={{ slug: buyerSlug(n.buyer) }} className="hover:text-accent hover:underline">{n.buyer}</Link> : "Buyer not disclosed"}{country ? ` · ${country}` : ""}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {SOURCES[n.source].label} · {n.noticeId} · published {fmtDate(n.publishedAt)}{n.cpv[0] ? ` · CPV ${n.cpv[0]}` : ""}{n.relatedNotices?.length ? ` · ${n.relatedNotices.length} matched register record` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:justify-center">
              <StatusPill n={n} />
              <span className="text-right">
                {money && <span className="block font-mono text-sm">{money}</span>}
                {n.valueEur != null && n.currency !== "EUR" && <span className="block font-mono text-[10px] text-muted-foreground">≈ {fmtMoney(n.valueEur, "EUR")} ECB</span>}
              </span>
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
    <details className="min-w-0 flex-1 rounded-md border border-border bg-card p-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        {result.items.length} notices · {result.storage === "database" ? "indexed search" : "live publisher search"} · {result.durationMs}ms
      </summary>
      <ul className="mt-3 grid gap-1.5 font-mono text-xs sm:grid-cols-2">
        {entries.map(([k, h]) => (
          <li key={k} className="flex justify-between gap-2">
            <span>{SOURCES[k as keyof typeof SOURCES].label}</span>
            <span className={h?.status === "ok" ? "text-success" : "text-muted-foreground"}>
              {h?.status === "ok" ? `${h.count} shown${h.total ? ` of ${h.total.toLocaleString()}` : ""}${h.latencyMs ? ` · ${h.latencyMs}ms` : ""}` : `${h?.status}${h?.message ? `: ${h.message}` : ""}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Retrieved {new Date(result.fetchedAt).toUTCString()}. Every record links back to its official publisher.</p>
    </details>
  );
}
