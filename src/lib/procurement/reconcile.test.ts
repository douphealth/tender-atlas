import { describe, expect, it } from "vitest";
import { normalize } from "./sources";
import { buyerSlug, reconcileNotices } from "./reconcile";
import { toEur } from "./money";

const record = (source: "ted" | "fr", id: string, title = "Hospital cybersecurity operations") => normalize({
  source, noticeId: id, title, buyer: "Example University Hospital", country: "FRA", deadline: "2027-01-15", publishedAt: "2026-11-16", url: `https://${source}.example/${id}`,
});

describe("directory reconciliation and money rules", () => {
  it("merges only exact cross-register matches and preserves the related record", () => {
    const items = reconcileNotices([record("fr", "FR-1"), record("ted", "123-2026")]);
    expect(items).toHaveLength(1);
    expect(items[0]!.source).toBe("ted");
    expect(items[0]!.relatedNotices?.[0]).toMatchObject({ source: "fr", noticeId: "FR-1" });
  });
  it("does not merge notices with different titles", () => {
    expect(reconcileNotices([record("fr", "FR-1"), record("ted", "123-2026", "Road maintenance services")])).toHaveLength(2);
  });
  it("uses the supplied ECB rate without changing the publisher amount", () => {
    const notice = record("ted", "123-2026");
    expect(toEur(notice.value, notice.currency, { date: "2026-11-16", rates: { EUR: 1, USD: 1.2 } })).toBeNull();
    expect(toEur(120, "USD", { date: "2026-11-16", rates: { EUR: 1, USD: 1.2 } })).toBe(100);
  });
  it("gives identical buyer names a stable profile slug", () => {
    expect(buyerSlug("Example University Hospital")).toBe(buyerSlug("Example University Hospital"));
    expect(buyerSlug("Example University Hospital")).not.toBe(buyerSlug("Other Hospital"));
  });
});
