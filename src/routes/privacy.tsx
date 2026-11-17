import { createFileRoute } from "@tanstack/react-router";
import { jsonLd, pageHead } from "@/lib/seo";
import { abs } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead({
    title: "Privacy",
    description: "TenderAtlas has no accounts. Saved tenders stay in your browser. Dossier and alert details are stored only to fulfil that request.",
    path: "/privacy",
    jsonLd: jsonLd([{ "@type": "WebPage", name: "Privacy", url: abs("/privacy"), description: "TenderAtlas has no accounts. Saved tenders stay in your browser. Dossier and alert details are stored only to fulfil that request." }]),
  }),
  component: () => (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed">
      <h1 className="text-4xl font-semibold">Privacy</h1>
      <p className="mt-4 text-lg text-muted-foreground">TenderAtlas has no user accounts. Saved tenders stay in this browser. A dossier request or email alert is stored only to fulfil that request.</p>
      <ul className="mt-6 list-disc space-y-2 pl-5">
        <li>There are no user accounts. Saved tenders, notes and saved searches are stored in your browser's local storage on this device only. Clearing site data deletes them.</li>
        <li>Your search terms are forwarded to the official publishers listed in the methodology to retrieve results.</li>
        <li>If you request or order a dossier, your tender reference, company, email, supplied context, accepted offer and payment status are stored in the owner's Cloudflare database to process and fulfil it. Stripe handles card details; TenderAtlas stores payment-session references, not card numbers. Do not submit confidential documents, credentials or sensitive personal information in the context field.</li>
        <li>Private order confirmation uses a random access token in this browser tab's session storage; the database holds only its hash. Closing the tab may remove access to this confirmation. Keep your Stripe receipt and order reference.</li>
        <li>If you create an email alert, your email and search are stored only to verify and deliver that alert. Every digest has an unsubscribe link that deletes the subscription and its delivery history.</li>
        <li>Cloudflare Turnstile protects public forms from spam. Cloudflare and Resend process the technical data needed to provide those services.</li>
        <li>We set no advertising or tracking cookies.</li>
      </ul>
    </article>
  ),
});
