import { createFileRoute } from "@tanstack/react-router";
import { SEO, seoPages, LLMS_NOTES } from "@/seo.config";

// llms.txt (https://llmstxt.org): a plain-text map of the site for AI assistants and answer engines.
export const Route = createFileRoute("/llms.txt")({
  server: { handlers: { GET: () => {
    const origin = SEO.origin.replace(/\/$/, "");
    const groups = new Map<string, string[]>();
    for (const p of seoPages()) {
      const g = p.section ?? "Pages";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(`- [${p.title}](${origin}${p.path})${p.desc ? `: ${p.desc.replace(/\s+/g, " ").trim()}` : ""}`);
    }
    const body = [`# ${SEO.name}`, "", `> ${SEO.description}`, "", ...LLMS_NOTES, "",
      ...[...groups].flatMap(([g, lines]) => [`## ${g}`, "", ...lines, ""])].join("\n");
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  } } },
});
