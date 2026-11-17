import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";

// Unmatched URLs. head runs with the not-found response so the shell is noindex.
export const Route = createFileRoute("/$")({
  head: () =>
    pageHead({
      title: "Page not found",
      description: "This page is not part of TenderAtlas.",
      path: "/",
      noindex: true,
      canonical: false,
    }),
  beforeLoad: () => {
    throw notFound();
  },
});
