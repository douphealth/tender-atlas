import { createFileRoute, Link } from "@tanstack/react-router";
import { SOURCES } from "@/lib/procurement/catalog";
import { fmtDate, daysLeft } from "@/components/atlas/format";
import { pageHead } from "@/lib/seo";
import { useWorkspace } from "@/lib/workspace";

const STAGES = ["reviewing", "qualifying", "bidding", "submitted", "dropped"];

export const Route = createFileRoute("/app")({
  head: () => pageHead({ title: "Your workspace", description: "Saved tenders, bid pipeline and saved searches, stored privately in your browser.", path: "/app", noindex: true }),
  component: Workspace,
});

function Workspace() {
  const ws = useWorkspace();
  const download = () => {
    const url = URL.createObjectURL(new Blob([ws.exportAll()], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: "tenderatlas-workspace.json" }).click();
    URL.revokeObjectURL(url);
  };
  const sorted = [...ws.notices].sort((a, b) => (a.deadlineAt ?? "9").localeCompare(b.deadlineAt ?? "9"));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Private · this browser only</p><h1 className="mt-1 text-4xl font-semibold">Workspace</h1></div>
        {ws.notices.length > 0 && <button onClick={download} className="rounded-sm border border-border px-3 py-1.5 text-sm hover:bg-secondary">Export JSON</button>}
      </div>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Bid pipeline</h2>
        {!ws.ready ? <p className="mt-3 text-muted-foreground">Loading…</p> : sorted.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border p-8 text-center text-muted-foreground">No saved tenders yet. Open any tender and choose “Save to workspace”. <Link to="/tenders" className="text-accent underline">Find tenders</Link></p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-card">
            {sorted.map((n) => {
              const left = daysLeft(n.deadlineAt);
              return (
                <li key={n.id} className="grid gap-3 p-4 md:grid-cols-[1fr_10rem_14rem_auto] md:items-center">
                  <div className="min-w-0">
                    {SOURCES[n.source].detailPages ? <Link to="/tenders/$source/$id" params={{ source: n.source, id: n.noticeId }} className="font-medium hover:underline">{n.title}</Link> : <a href={n.url ?? "#"} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{n.title} ↗</a>}
                    <p className="truncate text-sm text-muted-foreground">{n.buyer ?? "Buyer not disclosed"}</p>
                  </div>
                  <div className="text-sm">{fmtDate(n.deadlineAt)}{left != null && left >= 0 && <span className="block text-xs text-accent">{left} days left</span>}</div>
                  <div className="flex gap-2">
                    <select aria-label="Pipeline stage" value={n.stage} onChange={(e) => ws.update(n.id, { stage: e.target.value })} className="h-9 rounded-sm border border-input bg-background px-2 text-sm">{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
                    <input aria-label="Note" placeholder="Note" defaultValue={n.note} onBlur={(e) => ws.update(n.id, { note: e.target.value })} className="h-9 min-w-0 flex-1 rounded-sm border border-input bg-background px-2 text-sm" />
                  </div>
                  <button onClick={() => ws.remove(n.id)} className="text-sm text-muted-foreground hover:text-destructive">Remove</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="mt-12">
        <h2 className="text-xl font-semibold">Saved searches</h2>
        <p className="text-sm text-muted-foreground">Re-run to see what's new. Automatic email alerts are not available yet.</p>
        {ws.searches.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">None yet — use “Save this search” on the tenders page.</p> : (
          <ul className="mt-3 space-y-2">{ws.searches.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3 text-sm">
              <Link to="/tenders" search={s.params} className="font-medium hover:text-accent">{s.label} <span className="font-mono text-xs text-muted-foreground">{Object.entries(s.params).filter(([k]) => k !== "q").map(([k, v]) => `${k}:${v}`).join(" ")}</span></Link>
              <button onClick={() => ws.removeSearch(s.id)} className="text-muted-foreground hover:text-destructive">Remove</button>
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
