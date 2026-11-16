import { createFileRoute } from "@tanstack/react-router";
import { SOURCES, SOURCE_KEYS } from "@/lib/procurement/catalog";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/methodology")({
  head: () => pageHead({ title: "Methodology & data sources", description: "How TenderAtlas reads official procurement APIs, what each source covers, and what we never infer.", path: "/methodology" }),
  component: () => (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed">
      <p className="eyebrow">Methodology</p>
      <h1 className="mt-1 text-4xl font-semibold">How TenderAtlas reads tenders</h1>
      <p className="mt-5">Every notice is requested live from the publisher's official API when a page is viewed, then cached for a few minutes. We do not keep a private copy of the notice text, and we do not generate summaries or eligibility judgements.</p>
      <h2 className="mt-10 text-2xl font-semibold">Sources</h2>
      <ul className="mt-4 space-y-3">
        {SOURCE_KEYS.map((k) => <li key={k}><strong>{SOURCES[k].label}</strong> — {SOURCES[k].name}, {SOURCES[k].region}. <a className="text-accent underline" href={SOURCES[k].docs} target="_blank" rel="noopener noreferrer">API documentation</a></li>)}
      </ul>
      <h2 className="mt-10 text-2xl font-semibold">Rules we follow</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5">
        <li>A field missing from the official record is shown as “not disclosed”, never estimated.</li>
        <li>Deadlines are shown as dates; the exact time and time zone must be confirmed in the official notice.</li>
        <li>Where a notice has several lots, the earliest disclosed deadline is shown and labelled.</li>
        <li>CPV searches match the code's family (e.g. 72000000 covers all IT services). World Bank and SAM.gov do not use CPV and are excluded from CPV searches.</li>
        <li>UK Find a Tender results are a recent sample of updated releases, not a full national search.</li>
        <li>Pages for individual notices, countries and categories are only offered to search engines when they carry enough verified content.</li>
      </ul>
      <h2 className="mt-10 text-2xl font-semibold">Limitations</h2>
      <p className="mt-4">Coverage is bounded by what each publisher's API returns at the time of the request. Results are not a complete archive of all public tenders. Always verify in the original notice before preparing a bid.</p>
    </article>
  ),
});
