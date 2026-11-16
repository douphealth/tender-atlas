import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead({ title: "Privacy", description: "TenderAtlas has no accounts and stores your saved tenders only in your own browser.", path: "/privacy" }),
  component: () => (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed">
      <h1 className="text-4xl font-semibold">Privacy</h1>
      <ul className="mt-6 list-disc space-y-2 pl-5">
        <li>There are no user accounts. We do not collect names, emails or payment details on this site.</li>
        <li>Saved tenders, notes and saved searches are stored in your browser's local storage on this device only. Clearing site data deletes them.</li>
        <li>Your search terms are forwarded to the official publishers listed in the methodology to retrieve results.</li>
        <li>We set no advertising or tracking cookies.</li>
      </ul>
    </article>
  ),
});
