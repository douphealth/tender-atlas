import { describe, expect, it } from "vitest";
import { cpvMatches, dateOnly, formatCpv, isIndexable, mapWorldBankStage, normalize, parseSearch, tedQuery } from "./sources";

describe("procurement rules", () => {
  it("validates CPV check digits", () => {
    expect(formatCpv("72000000")).toBe("72000000-5");
    expect(formatCpv("72000000-1")).toBeNull();
  });
  it("matches CPV families", () => {
    expect(cpvMatches("72212000", "72000000")).toBe(true);
    expect(cpvMatches("45000000", "72000000")).toBe(false);
  });
  it("parses World Bank dd-Mon-yyyy dates", () => {
    expect(dateOnly("14-Nov-2026")).toBe("2026-11-14");
    expect(dateOnly("2026-02-30")).toBeNull();
  });
  it("uses earliest lot deadline", () => {
    expect(dateOnly(["2026-12-05+01:00", "2026-11-20+01:00"])).toBe("2026-11-20");
  });
  it("does not treat a World Bank award as open competition", () => {
    expect(mapWorldBankStage("Contract Award").status).toBe("awarded");
  });
  it("clamps search params", () => {
    expect(parseSearch({ days: "45", page: "99", source: "evil" })).toMatchObject({ days: 30, page: 99, source: "all" });
  });
  it("builds TED queries with country and CPV", () => {
    expect(tedQuery({ q: "", country: "DEU", days: 7, cpv: "72000000-5" })).toContain("buyer-country = DEU AND classification-cpv = 72000000");
  });
  it("does not index thin notices", () => {
    expect(isIndexable(normalize({ source: "ted", noticeId: "1-2026", title: "X", url: "https://ted.europa.eu" }))).toBe(false);
  });
});
