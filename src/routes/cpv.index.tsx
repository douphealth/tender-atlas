import { createFileRoute, Link } from "@tanstack/react-router";
import { CPV_DIVISIONS } from "@/lib/procurement/catalog";
import { itemList, jsonLd, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/cpv/")({
  head: () => pageHead({
    title: "Tenders by CPV category",
    description: "Browse public tenders by Common Procurement Vocabulary (CPV) division, from construction works to IT services.",
    path: "/cpv",
    jsonLd: jsonLd([itemList("Tenders by CPV division", CPV_DIVISIONS.map((d) => ({ name: d.name, path: `/cpv/${d.code}` })))]),
  }),
  component: () => (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="eyebrow">Common Procurement Vocabulary</p>
      <h1 className="mt-1 text-4xl font-semibold">Tenders by category</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Common Procurement Vocabulary divisions used by TED, BOAMP, KIMDIS and Find a Tender. A missing classification is shown as not disclosed, never guessed.</p>
      <ul className="mt-8 divide-y divide-border rounded-md border border-border bg-card">
        {CPV_DIVISIONS.map((d) => (
          <li key={d.code}><Link to="/cpv/$code" params={{ code: d.code }} className="flex gap-4 p-3 hover:bg-secondary"><span className="font-mono text-accent">{d.code}</span><span>{d.name}</span></Link></li>
        ))}
      </ul>
    </div>
  ),
});
