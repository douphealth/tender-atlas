import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertForm } from "@/components/atlas/AlertForm";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/alerts")({
  head: () => pageHead({ title: "Tender email alerts and RSS", description: "Create a confirmed daily email digest or subscribe to live public tender searches by RSS.", path: "/alerts" }),
  component: () => <div className="mx-auto max-w-3xl px-4 py-12"><p className="eyebrow">Monitoring</p><h1 className="mt-1 text-4xl font-semibold">Never miss a matching notice</h1><p className="mt-4 text-lg text-muted-foreground">Choose a search on the directory, then create a double opt-in daily email alert. Every notice links to the official record.</p><AlertForm query={{ days: 7 }} /><div className="mt-8 rounded-md bg-secondary p-5"><h2 className="text-xl font-semibold">Prefer your own reader?</h2><p className="mt-2 text-sm text-muted-foreground">Every tender search has an RSS feed. Add your filters on the search page, then copy its RSS link into your reader or automation tool.</p><Link to="/tenders" className="mt-4 inline-block text-accent underline">Build a tender search</Link></div><p className="mt-6 text-xs text-muted-foreground">To stop an alert, use the unsubscribe link in any digest. Verification and unsubscribe links are single-purpose secrets; do not forward them.</p></div>,
});
