/* eslint-disable @typescript-eslint/no-explicit-any */
// Official public procurement source adapters. Pure fetch-based code: runs on Cloudflare Workers.
// Rule: the absence of an upstream field is never a license to infer it.
import { SOURCES, isSourceKey, type SourceKey } from "./catalog";
import { officialEuroRates, toEur } from "./money";
import { reconcileNotices } from "./reconcile";

export type Stage = "competition" | "planning" | "award" | "disposal" | "unknown";
export interface Notice {
  id: string;
  noticeId: string;
  source: SourceKey;
  title: string;
  buyer: string | null;
  country: string | null;
  countryName: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  deadlineAt: string | null;
  deadlineKind: "tender" | "request" | "unknown";
  deadlineRaw: string | null;
  deadlineTimezone: string | null;
  deadlineBasis: string | null;
  value: number | null;
  currency: string | null;
  /** Indicative conversion using the ECB reference rate; never a publisher-supplied field. */
  valueEur?: number | null;
  relatedNotices?: { source: SourceKey; noticeId: string; url: string | null }[];
  cpv: string[];
  description: string | null;
  noticeType: string | null;
  procedure: string | null;
  stage: Stage;
  status: string;
  url: string | null;
  documents: { label: string; url: string }[];
  provenance: string;
  fetchedAt: string;
}
export interface SearchParams {
  q: string;
  source: SourceKey | "all";
  country: string; // ISO3 or ""
  days: number;
  page: number;
  cpv: string; // ########-# or ""
  deadline: "any" | "48h" | "7d";
  minValueEur?: number | undefined;
  maxValueEur?: number | undefined;
}
export interface SourceHealth {
  status: "ok" | "error" | "not-queried" | "not-configured" | "excluded";
  count: number;
  latencyMs?: number;
  message?: string;
  total?: number | null;
  coverage?: string;
}
export interface SearchResult {
  items: Notice[];
  health: Partial<Record<SourceKey, SourceHealth>>;
  fetchedAt: string;
  durationMs: number;
  params: SearchParams;
  storage?: "live" | "database";
  total?: number;
  pageSize?: number;
  hasNext?: boolean;
  euroRatesDate?: string | undefined;
}

const TIMEOUT = 20000;
export const ALLOWED_DAYS = [7, 14, 30, 60, 90];
// Generous abuse ceiling, not a four-page directory limit. Stored search uses SQL offsets.
export const MAX_PAGE = 1000;

// ---------- pure helpers ----------
const CPV_WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7];
export function computeCpvCheckDigit(eight: string): string | null {
  if (!/^\d{8}$/.test(eight)) return null;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(eight[i]) * CPV_WEIGHTS[i]!;
  return String(sum % 10);
}
export function formatCpv(raw: string): string | null {
  const m = String(raw || "").trim().match(/^(\d{8})(?:-(\d))?$/);
  if (!m) return null;
  const expected = computeCpvCheckDigit(m[1]!);
  if (m[2] !== undefined && m[2] !== expected) return null;
  return `${m[1]}-${expected}`;
}
export function cpvPrefix(cpv: string): string {
  const s = String(cpv || "").replace(/\D/g, "").slice(0, 8);
  const t = s.replace(/0+$/, "");
  return t.length >= 2 ? t : s.slice(0, 2);
}
export function cpvMatches(noticeCpv: string, target: string): boolean {
  const n = String(noticeCpv || "").replace(/\D/g, "").slice(0, 8);
  const t = String(target || "").replace(/\D/g, "").slice(0, 8);
  return Boolean(n && t && n.startsWith(cpvPrefix(t)));
}
const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
export function dateOnly(value: any): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(dateOnly).filter(Boolean).sort()[0] ?? null;
  const s = String(value).trim();
  let y: string, mo: string, d: string;
  let m = s.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})/);
  if (m) { y = m[1]!; mo = m[2]!; d = m[3]!; }
  else if ((m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})/)) && MONTHS[m[2]!.toLowerCase()]) {
    y = m[3]!; mo = MONTHS[m[2]!.toLowerCase()]!; d = m[1]!.padStart(2, "0");
  } else return null;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d));
  return dt.getUTCFullYear() === +y && dt.getUTCMonth() === +mo - 1 && dt.getUTCDate() === +d ? `${y}-${mo}-${d}` : null;
}
export function extractTimezone(raw: any): string | null {
  const s = String(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "").trim();
  if (!s) return null;
  if (/Z$/i.test(s)) return "UTC";
  const m = s.match(/([+-]\d{2}:?\d{2})$/);
  return m ? `UTC${m[1]}` : null;
}
const LANG_PREF = ["eng", "en", "ENG", "fra", "deu", "ell", "el"];
export function text(x: any, max = 300): string {
  if (x == null) return "";
  if (Array.isArray(x)) return text(x[0], max);
  if (typeof x === "object") {
    for (const k of LANG_PREF) if (x[k] != null) return text(x[k], max);
    return text(x.value ?? x.name ?? Object.values(x)[0], max);
  }
  return String(x).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
const amount = (x: any) => {
  const v = Number(String(Array.isArray(x) ? x[0] : x ?? "").replace(/\s/g, ""));
  return Number.isFinite(v) && v > 0 ? v : null;
};
export function cpvCodes(items: any): string[] {
  const out: string[] = [];
  const read = (x: any): void => {
    if (Array.isArray(x)) return x.forEach(read);
    if (x && typeof x === "object") return read(x.id ?? x.key ?? x.value ?? x.code ?? x.cpvs ?? "");
    const m = String(x ?? "").match(/\b\d{8}(?:-\d)?\b/g);
    if (m) out.push(...m.map((c) => c.slice(0, 8)));
  };
  read(items);
  return [...new Set(out)].slice(0, 16);
}
function safeLink(value: any, hosts: string[]): string | null {
  try {
    const u = new URL(String(value));
    if (u.protocol === "https:" && hosts.some((h) => u.hostname === h || u.hostname.endsWith("." + h))) return u.href;
  } catch { /* invalid */ }
  return null;
}
const today = () => new Date().toISOString().slice(0, 10);
const dayAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

export function normalize(x: any): Notice {
  const deadlineAt = dateOnly(x.deadline);
  const st = String(x.status || "").toLowerCase();
  const status = ["awarded", "cancelled", "closed", "inactive", "disposal"].includes(st)
    ? st
    : deadlineAt && deadlineAt < today() ? "deadline-passed" : deadlineAt ? "open" : "unknown";
  return {
    id: `${x.source}:${text(x.noticeId, 160)}`,
    noticeId: text(x.noticeId, 160),
    source: x.source,
    title: text(x.title, 420) || "Untitled notice",
    buyer: text(x.buyer, 250) || null,
    country: /^[A-Z]{3}$/.test(String(x.country || "")) ? x.country : null,
    countryName: text(x.countryName, 80) || null,
    publishedAt: dateOnly(x.publishedAt),
    updatedAt: dateOnly(x.updatedAt),
    deadlineAt,
    deadlineKind: x.deadlineKind ?? "unknown",
    deadlineRaw: x.deadline ? text(x.deadline, 64) : null,
    deadlineTimezone: extractTimezone(x.deadline),
    deadlineBasis: x.deadlineBasis ?? null,
    value: amount(x.value),
    currency: text(x.currency, 3).toUpperCase() || null,
    cpv: cpvCodes(x.cpv),
    description: text(x.description, 2400) || null,
    noticeType: text(x.noticeType, 120) || null,
    procedure: text(x.procedure, 90) || null,
    stage: x.stage ?? "unknown",
    status,
    url: x.url ?? null,
    documents: Array.isArray(x.documents) ? x.documents.filter((d: any) => d && typeof d.url === "string").slice(0, 8) : [],
    provenance: text(x.provenance, 140),
    fetchedAt: new Date().toISOString(),
  };
}

async function remoteJSON(url: string, opt: RequestInit = {}): Promise<any> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { ...opt, signal: c.signal, headers: { Accept: "application/json", "User-Agent": "TenderAtlas/1.0 (+https://tender-atlas.pages.dev/methodology)", ...(opt.headers || {}) } });
    if (!r.ok) throw new Error(r.status === 429 ? "Rate limited by publisher" : `Publisher HTTP ${r.status}`);
    if (!/json/i.test(r.headers.get("content-type") || "")) throw new Error("Publisher returned non-JSON");
    return await r.json();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Publisher timed out");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- TED ----------
const TED_FIELDS = ["publication-number", "publication-date", "notice-title", "buyer-name", "buyer-country", "classification-cpv", "deadline-receipt-tender-date-lot", "deadline-receipt-request-date-lot", "notice-type", "estimated-value-proc", "estimated-value-cur-proc", "procedure-type"];
export function tedQuery(p: Pick<SearchParams, "q" | "country" | "days" | "cpv">): string {
  const parts = [`publication-date >= ${dayAgo(p.days).replaceAll("-", "")}`, "form-type = competition"];
  if (/^[A-Z]{3}$/.test(p.country)) parts.push(`buyer-country = ${p.country}`);
  if (/^\d{8}/.test(p.cpv)) parts.push(`classification-cpv = ${p.cpv.slice(0, 8)}`);
  const terms = (p.q.match(/[\p{L}\p{N}]+/gu) || []).filter((t) => t.length > 1).slice(0, 6).map((t) => t.slice(0, 35));
  if (terms.length) parts.push(terms.length === 1 ? `FT ~ ${terms[0]}` : `FT ~ (${terms.join(" ")})`);
  return parts.join(" AND ");
}
function tedMap(n: any): Notice | null {
  const id = text(n["publication-number"], 60);
  if (!/^\d{1,9}-\d{4}$/.test(id)) return null;
  const tender = n["deadline-receipt-tender-date-lot"];
  const request = n["deadline-receipt-request-date-lot"];
  const desc = n["description-proc"] ?? n["description-lot"];
  return normalize({
    source: "ted", noticeId: id, title: n["notice-title"], buyer: n["buyer-name"],
    country: text(n["buyer-country"], 3), publishedAt: n["publication-date"],
    deadline: tender ?? request, deadlineKind: tender ? "tender" : request ? "request" : "unknown",
    deadlineBasis: Array.isArray(tender ?? request) && (tender ?? request).length > 1 ? "Earliest date across disclosed lots" : null,
    value: n["estimated-value-proc"], currency: n["estimated-value-cur-proc"], cpv: n["classification-cpv"],
    noticeType: n["notice-type"], procedure: n["procedure-type"], stage: "competition", description: desc,
    url: `https://ted.europa.eu/en/notice/-/detail/${id}`,
    documents: [{ label: "Official notice PDF (EN)", url: `https://ted.europa.eu/en/notice/${id}/pdf` }],
    provenance: "TED Search API v3",
  });
}
async function tedFeed(p: SearchParams) {
  const d = await remoteJSON("https://api.ted.europa.eu/v3/notices/search", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: tedQuery(p), fields: TED_FIELDS, page: p.page, limit: 50, scope: "ALL", paginationMode: "PAGE_NUMBER", checkQuerySyntax: false }),
  });
  if (!Array.isArray(d.notices)) throw new Error("Unexpected TED response");
  return { notices: d.notices.map(tedMap).filter(Boolean) as Notice[], total: Number(d.totalNoticeCount) || null, coverage: "TED competition notices; publisher-side keyword, date, CPV and country filters" };
}
export async function tedNotice(id: string): Promise<Notice | null> {
  if (!/^\d{1,9}-\d{4}$/.test(id)) return null;
  const d = await remoteJSON("https://api.ted.europa.eu/v3/notices/search", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: `publication-number = ${id}`, fields: [...TED_FIELDS, "description-proc", "description-lot", "place-of-performance"], page: 1, limit: 1, paginationMode: "PAGE_NUMBER" }),
  });
  return d.notices?.[0] ? tedMap(d.notices[0]) : null;
}

// ---------- BOAMP ----------
export function mapBoampStage(n: any): { stage: Stage; status: string | null } {
  const hay = `${n?.nature || ""} ${n?.nature_libelle || ""} ${n?.etat || ""}`.toLowerCase();
  if (/attribution|r[eé]sultat|award/.test(hay)) return { stage: "award", status: "awarded" };
  if (/annul|sans suite|cancel/.test(hay)) return { stage: "unknown", status: "cancelled" };
  if (/pr[eé]-?information|planning/.test(hay)) return { stage: "planning", status: null };
  if (/appel|avis de march[eé]|concession/.test(hay)) return { stage: "competition", status: null };
  return { stage: "unknown", status: null };
}
function boampMap(n: any): Notice | null {
  const id = text(n.idweb, 80);
  if (!id) return null;
  const { stage, status } = mapBoampStage(n);
  const url = safeLink(n.url_avis, ["boamp.fr"]) || `https://www.boamp.fr/pages/avis/?q=idweb:${encodeURIComponent(id)}`;
  return normalize({
    source: "fr", noticeId: id, title: n.objet || `BOAMP ${id}`, buyer: n.nomacheteur, country: "FRA",
    publishedAt: n.dateparution, deadline: n.datelimitereponse, deadlineKind: n.datelimitereponse ? "tender" : "unknown",
    currency: "EUR", cpv: n.code_cpv ? [n.code_cpv] : [], description: [n.objet, Array.isArray(n.descripteur_libelle) ? `Descriptors: ${n.descripteur_libelle.join(", ")}` : ""].filter(Boolean).join(". "),
    noticeType: n.nature_libelle || n.nature, procedure: n.procedure_libelle, stage, status, url,
    provenance: "France BOAMP Open Data (DILA)",
  });
}
const BOAMP = "https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records";
const odsq = (s: string) => s.replace(/["\\]/g, "");
async function boampFeed(p: SearchParams) {
  const clauses = [`dateparution >= date'${dayAgo(p.days)}'`];
  if (p.q) clauses.push(`search(objet, "${odsq(p.q)}")`);
  if (p.cpv) clauses.push(`search(code_cpv, "${p.cpv.slice(0, 8)}")`);
  const qs = new URLSearchParams({ where: clauses.join(" AND "), limit: "40", offset: String((p.page - 1) * 40), order_by: "dateparution DESC" });
  const d = await remoteJSON(`${BOAMP}?${qs}`);
  if (!Array.isArray(d.results)) throw new Error("Unexpected BOAMP response");
  return { notices: d.results.map(boampMap).filter(Boolean) as Notice[], total: Number(d.total_count) || null, coverage: "French BOAMP official register" };
}
export async function boampNotice(id: string): Promise<Notice | null> {
  if (!/^[\w-]{3,40}$/.test(id)) return null;
  const d = await remoteJSON(`${BOAMP}?${new URLSearchParams({ where: `idweb="${odsq(id)}"`, limit: "1" })}`);
  return d.results?.[0] ? boampMap(d.results[0]) : null;
}

// ---------- World Bank ----------
export function mapWorldBankStage(t0: any): { stage: Stage; status: string | null } {
  const t = String(t0 || "").toLowerCase();
  if (/cancel/.test(t)) return { stage: "unknown", status: "cancelled" };
  if (/award/.test(t)) return { stage: "award", status: "awarded" };
  if (/general procurement|prior information|planning/.test(t)) return { stage: "planning", status: null };
  if (/invitation for bids|request for (proposals|bids|quotations)|expressions? of interest|tender|bid/.test(t)) return { stage: "competition", status: null };
  return { stage: "unknown", status: null };
}
function wbMap(n: any): Notice | null {
  const id = text(n.id, 80);
  if (!id) return null;
  const { stage, status } = mapWorldBankStage(n.notice_type);
  const title = text(n.bid_description, 420) || text(n.project_name, 420) || `World Bank notice ${id}`;
  return normalize({
    source: "wb", noticeId: id, title, buyer: n.borrower || n.contact_organization || null,
    countryName: n.project_ctry_name, publishedAt: n.noticedate, deadline: stage === "competition" ? n.submission_date : null,
    deadlineKind: stage === "competition" && n.submission_date ? "tender" : "unknown",
    description: [n.project_name && `Project ${n.project_id ?? ""}: ${n.project_name}`, n.notice_type, n.bid_reference_no && `Reference ${n.bid_reference_no}`, text(n.notice_text, 1600)].filter(Boolean).join(" — "),
    noticeType: n.notice_type, procedure: n.procurement_method_name, stage, status,
    url: `https://projects.worldbank.org/en/projects-operations/procurement-detail/${encodeURIComponent(id)}`,
    provenance: "World Bank Procurement Notices API v2",
  });
}
async function worldBankFeed(p: SearchParams) {
  const params = new URLSearchParams({ format: "json", rows: "50", os: String((p.page - 1) * 50), srt: "noticedate", order: "desc" });
  if (p.q) params.set("qterm", p.q.slice(0, 80));
  const d = await remoteJSON(`https://search.worldbank.org/api/v2/procnotices?${params}`);
  const raw = Array.isArray(d?.procnotices) ? d.procnotices : Object.values(d?.procnotices ?? {});
  const min = dayAgo(p.days);
  const notices = (raw.map(wbMap).filter(Boolean) as Notice[]).filter((n) => n.publishedAt && n.publishedAt >= min);
  return { notices, total: Number(d?.total) || null, coverage: "World Bank-financed notices (post-filtered by date)" };
}
export async function worldBankNotice(id: string): Promise<Notice | null> {
  if (!/^[A-Z]{2}\d{5,12}$/.test(id)) return null;
  const d = await remoteJSON(`https://search.worldbank.org/api/v2/procnotices?format=json&id=${encodeURIComponent(id)}`);
  const raw = Array.isArray(d?.procnotices) ? d.procnotices : Object.values(d?.procnotices ?? {});
  const hit = raw.find((n: any) => n?.id === id);
  return hit ? wbMap(hit) : null;
}

// ---------- Greece KIMDIS ----------
function greekMap(n: any): Notice | null {
  const id = text(n.referenceNumber ?? n.id, 100);
  if (!id) return null;
  const doc = `https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice/attachment/${encodeURIComponent(id)}`;
  return normalize({
    source: "gr", noticeId: id, title: n.title || n.objectDetails?.[0]?.shortDescription, buyer: n.organization?.value ?? n.organizationName,
    country: "GRC", publishedAt: n.submissionDate ?? n.publishedDate, updatedAt: n.lastUpdateDate, deadline: n.finalSubmissionDate,
    deadlineKind: n.finalSubmissionDate ? "tender" : "unknown", value: n.totalCostWithoutVAT ?? n.totalCost, currency: "EUR",
    cpv: (n.objectDetails || []).flatMap((o: any) => o.cpvs || o.cpvItems || []), description: n.objectDetails?.[0]?.shortDescription,
    noticeType: n.procedureType, stage: "competition", status: n.cancelled ? "cancelled" : null,
    url: `https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice/${encodeURIComponent(id)}`,
    documents: [{ label: "KIMDIS official PDF", url: doc }], provenance: "KIMDIS Open Data API",
  });
}
async function greekFeed(p: SearchParams) {
  const body: any = { dateFrom: dayAgo(p.days), dateTo: today() };
  if (p.cpv) body.cpvItems = [p.cpv];
  if (p.q) body.title = p.q;
  const d = await remoteJSON(`https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=${p.page - 1}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!Array.isArray(d.content)) throw new Error("Unexpected KIMDIS response");
  const notices = d.content.map(greekMap).filter(Boolean) as Notice[];
  return { notices, total: Number(d.totalElements) || null, coverage: "Greek KIMDIS register; title/CPV filter" };
}
export async function greekNotice(id: string): Promise<Notice | null> {
  if (!/^[\w:./-]{2,100}$/.test(id)) return null;
  const d = await remoteJSON(`https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice/${encodeURIComponent(id)}`);
  return greekMap(d);
}

// ---------- UK Find a Tender ----------
function httpsDocument(d: any): { label: string; url: string } | null {
  try {
    const url = new URL(String(d?.url));
    return url.protocol === "https:" ? { label: text(d.title ?? d.description, 140) || "Official tender document", url: url.href } : null;
  } catch { return null; }
}
function ukPackageNotices(releases: any[]): Notice[] {
  const byOcid = new Map<string, any[]>();
  for (const r of releases) {
    const k = text(r.ocid || r.id, 130);
    if (k) byOcid.set(k, [...(byOcid.get(k) ?? []), r]);
  }
  return [...byOcid.entries()].map(([ocid, rels]) => {
    const sorted = [...rels].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const m: any = { tags: [] as string[], documents: [] as { label: string; url: string }[] };
    for (const r of sorted) {
      const t = r.tender || {};
      m.title = t.title ?? m.title;
      m.buyer = r.buyer?.name ?? r.parties?.find((z: any) => z.roles?.includes("buyer"))?.name ?? m.buyer;
      m.deadline = t.tenderPeriod?.endDate ?? m.deadline;
      m.value = t.value?.amount ?? m.value;
      m.currency = t.value?.currency ?? m.currency;
      const c = (t.items || []).flatMap((z: any) => [z.classification, ...(z.additionalClassifications || [])]).filter(Boolean);
      if (c.length) m.cpv = c;
      m.description = t.description ?? m.description;
      if (Array.isArray(r.tag)) m.tags = r.tag;
      if (Array.isArray(t.documents)) m.documents = t.documents.map(httpsDocument).filter(Boolean);
      const num = (String(r.id).match(/\d{5,8}-\d{4}/) || [])[0];
      if (num) m.url = `https://www.find-tender.service.gov.uk/Notice/${num}`;
    }
    const stage: Stage = m.tags.some((x: string) => /award/i.test(x)) ? "award" : m.tags.some((x: string) => /tender/i.test(x)) ? "competition" : m.tags.some((x: string) => /planning/i.test(x)) ? "planning" : "unknown";
    return normalize({
      source: "uk", noticeId: ocid, title: m.title || ocid, buyer: m.buyer, country: "GBR", publishedAt: sorted[0]?.date, updatedAt: sorted.at(-1)?.date,
      deadline: m.deadline, deadlineKind: m.deadline ? "tender" : "unknown", value: m.value, currency: m.currency, cpv: m.cpv,
      description: m.description, noticeType: m.tags.join(", "), stage, status: stage === "award" ? "awarded" : null, documents: m.documents,
      url: m.url || `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages/${encodeURIComponent(ocid)}`, provenance: `UK Find a Tender OCDS (${sorted.length} release${sorted.length > 1 ? "s" : ""})`,
    });
  });
}
async function ukFeed(p: SearchParams) {
  const qs = new URLSearchParams({ updatedFrom: dayAgo(Math.min(p.days, 14)) + "T00:00:00", updatedTo: today() + "T23:59:59", limit: "100" });
  const d = await remoteJSON(`https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?${qs}`);
  if (!Array.isArray(d.releases)) throw new Error("Unexpected UK OCDS response");
  const needle = p.q.toLocaleLowerCase();
  const notices = ukPackageNotices(d.releases).filter((n) => !needle || `${n.title} ${n.buyer ?? ""} ${n.description ?? ""}`.toLocaleLowerCase().includes(needle));
  return { notices, total: null, coverage: "Most recent UK releases (sample, keywords matched locally)" };
}
export async function ukNotice(id: string): Promise<Notice | null> {
  if (!/^[a-z0-9-]{3,130}$/.test(id)) return null;
  const d = await remoteJSON(`https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages/${encodeURIComponent(id)}`);
  return Array.isArray(d.releases) ? ukPackageNotices(d.releases).find((n) => n.noticeId === id) ?? null : null;
}

// ---------- SAM.gov ----------
const usDate = (iso: string) => { const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };
function samMap(n: any): Notice {
  const documents = Array.isArray(n.resourceLinks) ? n.resourceLinks.map((url: string, index: number) => ({ label: `SAM.gov attachment ${index + 1}`, url })).filter((d: { url: string }) => safeLink(d.url, ["sam.gov"])) : [];
  return normalize({
    source: "sam", noticeId: n.noticeId, title: n.title, buyer: n.fullParentPathName || n.department, country: "USA", publishedAt: n.postedDate, updatedAt: n.modifiedDate,
    deadline: n.responseDeadLine, deadlineKind: "tender", noticeType: n.type, stage: /award/i.test(n.type) ? "award" : "competition",
    status: n.active === "No" ? "inactive" : null, url: safeLink(n.uiLink, ["sam.gov"]) || `https://sam.gov/opp/${encodeURIComponent(n.noticeId)}/view`, documents,
    description: n.description && !String(n.description).startsWith("http") ? n.description : null, provenance: "SAM.gov public opportunities API",
  });
}
async function samFeed(p: SearchParams, key?: string) {
  if (!key) return { notices: [] as Notice[], total: null, coverage: "SAM_GOV_API_KEY not configured", disabled: true };
  const params = new URLSearchParams({ api_key: key, postedFrom: usDate(dayAgo(Math.min(90, p.days))), postedTo: usDate(today()), limit: "50", offset: String((p.page - 1) * 50) });
  if (p.q) params.set("title", p.q.slice(0, 70));
  const d = await remoteJSON(`https://api.sam.gov/opportunities/v2/search?${params}`);
  if (!Array.isArray(d.opportunitiesData)) throw new Error("Unexpected SAM.gov response");
  const notices = d.opportunitiesData.map(samMap);
  return { notices, total: Number(d.totalRecords) || null, coverage: "US SAM.gov opportunities" };
}
export async function samNotice(id: string, key?: string): Promise<Notice | null> {
  if (!key || !/^[a-f0-9]{16,64}$/i.test(id)) return null;
  const params = new URLSearchParams({ api_key: key, noticeid: id, limit: "1" });
  const d = await remoteJSON(`https://api.sam.gov/opportunities/v2/search?${params}`);
  const hit = d.opportunitiesData?.find((n: any) => n.noticeId === id);
  return hit ? samMap(hit) : null;
}

// ---------- orchestration ----------
const FEEDS: Record<SourceKey, (p: SearchParams, env: Env) => Promise<{ notices: Notice[]; total: number | null; coverage: string; disabled?: boolean }>> = {
  ted: tedFeed, fr: boampFeed, wb: worldBankFeed, gr: greekFeed, uk: ukFeed, sam: (p, env) => samFeed(p, env.SAM_GOV_API_KEY),
};
export interface Env { SAM_GOV_API_KEY?: string | undefined }
const servesCountry = (s: SourceKey, c: string) =>
  !c || s === "ted" || (s === "gr" && c === "GRC") || (s === "uk" && c === "GBR") || (s === "fr" && c === "FRA") || (s === "sam" && c === "USA");

export function parseSearch(input: Record<string, unknown>): SearchParams {
  const q = String(input["q"] ?? "").trim().slice(0, 100);
  const src = String(input["source"] ?? "all");
  const source = src !== "all" && Object.hasOwn(SOURCES, src) ? (src as SourceKey) : "all";
  const country = String(input["country"] ?? "").toUpperCase();
  const days = ALLOWED_DAYS.includes(Number(input["days"])) ? Number(input["days"]) : 30;
  const page = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(input["page"]) || 1)));
  const cpv = input["cpv"] ? formatCpv(String(input["cpv"])) ?? "" : "";
  const deadline = input["deadline"] === "48h" || input["deadline"] === "7d" ? input["deadline"] : "any";
  const boundedAmount = (key: string) => {
    if (input[key] == null || input[key] === "") return undefined;
    const value = Number(input[key]);
    return Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000 ? value : undefined;
  };
  return { q, source, country: /^[A-Z]{3}$/.test(country) ? country : "", days, page, cpv, deadline, minValueEur: boundedAmount("minValueEur"), maxValueEur: boundedAmount("maxValueEur") };
}

export async function collect(p: SearchParams, env: Env = {}, only?: SourceKey[]): Promise<SearchResult> {
  const started = Date.now();
  const wanted = (only ?? (Object.keys(SOURCES) as SourceKey[])).filter((s) => (p.source === "all" || s === p.source) && servesCountry(s, p.country));
  const health: SearchResult["health"] = {};
  const results = await Promise.all(wanted.map(async (s) => {
    if (p.cpv && !SOURCES[s].supportsCpv) return { s, excluded: true as const };
    const t = Date.now();
    try { return { s, r: await FEEDS[s](p, env), ms: Date.now() - t }; }
    catch (e: any) { return { s, error: text(e?.message, 100) || "Unknown error", ms: Date.now() - t }; }
  }));
  const seen = new Set<string>();
  const items: Notice[] = [];
  for (const x of results) {
    if ("excluded" in x) { health[x.s] = { status: "excluded", count: 0, message: "Source does not use CPV codes" }; continue; }
    if ("error" in x) { health[x.s] = { status: "error", count: 0, latencyMs: x.ms, message: x.error }; continue; }
    if (x.r.disabled) { health[x.s] = { status: "not-configured", count: 0, message: x.r.coverage }; continue; }
    let count = 0;
    for (const n of x.r.notices) {
      if (p.country && n.country && n.country !== p.country) continue;
      if (p.cpv && !n.cpv.some((c) => cpvMatches(c, p.cpv))) continue;
      if (seen.has(n.id)) continue;
      seen.add(n.id); items.push(n); count++;
    }
    health[x.s] = { status: "ok", count, latencyMs: x.ms, total: x.r.total, coverage: x.r.coverage };
  }
  const rates = items.some((n) => n.value != null) ? await officialEuroRates() : null;
  let visible: Notice[] = items.map((n) => ({ ...n, valueEur: toEur(n.value, n.currency, rates) }));
  if (p.deadline !== "any") {
    const now = today();
    const end = new Date(Date.now() + (p.deadline === "48h" ? 2 : 7) * 86400000).toISOString().slice(0, 10);
    visible = visible.filter((n) => n.deadlineAt && n.deadlineAt >= now && n.deadlineAt <= end);
  }
  if (p.minValueEur != null) visible = visible.filter((n) => n.valueEur != null && n.valueEur >= p.minValueEur!);
  if (p.maxValueEur != null) visible = visible.filter((n) => n.valueEur != null && n.valueEur <= p.maxValueEur!);
  visible = reconcileNotices(visible).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  return { items: visible, health, fetchedAt: new Date().toISOString(), durationMs: Date.now() - started, params: p, euroRatesDate: rates?.date } as SearchResult;
}

export async function fetchNotice(source: string, id: string, env: Env = {}): Promise<Notice | null> {
  if (!isSourceKey(source)) return null;
  try {
    if (source === "ted") return await tedNotice(id);
    if (source === "fr") return await boampNotice(id);
    if (source === "wb") return await worldBankNotice(id);
    if (source === "gr") return await greekNotice(id);
    if (source === "uk") return await ukNotice(id);
    if (source === "sam") return await samNotice(id, env.SAM_GOV_API_KEY);
  } catch (error) {
    console.error("Official notice lookup failed", { source, id, message: error instanceof Error ? error.message : "Unknown error" });
    return null;
  }
  return null;
}

/** Index a detail page only when the record carries enough verified substance. */
export function isIndexable(n: Notice): boolean {
  return Boolean(n.title && n.title !== "Untitled notice" && n.buyer && (n.deadlineAt || n.value || n.cpv.length) && n.url);
}

/** Facts that the official record does not disclose — shown, never guessed. */
export function unknowns(n: Notice): string[] {
  const out: string[] = [];
  if (!n.buyer) out.push("Contracting authority not disclosed in the published summary");
  if (!n.deadlineAt) out.push("Submission deadline not disclosed");
  else if (!n.deadlineTimezone) out.push("Deadline time zone not disclosed — check the official notice");
  if (!n.value) out.push("Estimated contract value not disclosed");
  if (!n.cpv.length) out.push("No CPV classification in the record");
  out.push("Eligibility, selection criteria and mandatory documents must be read in the official tender documents");
  return out;
}

export function makeIcs(n: { title: string; deadlineAt: string; url?: string | null; id: string }): string {
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const d = n.deadlineAt.replaceAll("-", "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TenderAtlas//EN", "BEGIN:VEVENT",
    `UID:${esc(n.id)}@tenderatlas`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${esc("Tender deadline: " + n.title.slice(0, 160))}`,
    `DESCRIPTION:${esc("Verify the exact time in the official notice. " + (n.url ?? ""))}`,
    ...(n.url ? [`URL:${n.url}`] : []), "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
