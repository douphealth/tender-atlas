import type { Notice } from "./sources";

const fold = (value: string | null) => (value ?? "").toLocaleLowerCase().normalize("NFKD").replace(/[\p{M}\p{P}\p{S}]/gu, "").replace(/\s+/g, " ").trim();
const NATIONAL = new Set(["fr", "gr", "uk"]);

/** Conservative reconciliation: only exact buyer/title/deadline matches across EU/national registers. */
export function reconciliationKey(n: Notice): string | null {
  if (!n.buyer || !n.deadlineAt || !n.country || fold(n.title).length < 16) return null;
  if (n.source !== "ted" && !NATIONAL.has(n.source)) return null;
  return [n.country, fold(n.buyer), fold(n.title), n.deadlineAt].join("|");
}

export function reconcileNotices(items: Notice[]): Notice[] {
  const groups = new Map<string, Notice[]>();
  const output: Notice[] = [];
  for (const notice of items) {
    const key = reconciliationKey(notice);
    if (!key) { output.push(notice); continue; }
    const group = groups.get(key);
    if (!group) { groups.set(key, [notice]); output.push(notice); continue; }
    const existing = group[0]!;
    const related = { source: notice.source, noticeId: notice.noticeId, url: notice.url };
    const reverse = { source: existing.source, noticeId: existing.noticeId, url: existing.url };
    existing.relatedNotices = [...(existing.relatedNotices ?? []), related, ...(notice.relatedNotices ?? [])];
    notice.relatedNotices = [...(notice.relatedNotices ?? []), reverse];
    // Prefer the EU publication as the canonical parent when it is present.
    if (notice.source === "ted" && existing.source !== "ted") {
      notice.relatedNotices = [...(notice.relatedNotices ?? []), ...(existing.relatedNotices ?? []).filter((r) => r.source !== notice.source || r.noticeId !== notice.noticeId)];
      const index = output.indexOf(existing);
      if (index >= 0) output[index] = notice;
      group[0] = notice;
    }
  }
  return output;
}

export function buyerSlug(name: string): string {
  const base = fold(name).replace(/\s/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "buyer";
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) { hash ^= name.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `${base}-${(hash >>> 0).toString(36)}`;
}
