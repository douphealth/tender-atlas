export const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
export const fmtMoney = (v: number | null, c: string | null) =>
  v == null ? null : new Intl.NumberFormat("en-GB", { style: c ? "currency" : "decimal", currency: c || undefined, maximumFractionDigits: 0 }).format(v);
export function daysLeft(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((Date.parse(d + "T23:59:59Z") - Date.now()) / 86400000);
}
