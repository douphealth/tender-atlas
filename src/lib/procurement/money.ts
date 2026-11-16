// Official ECB reference rates, cached per isolate. Conversion is indicative, never a publisher fact.
export interface EuroRates { date: string; rates: Record<string, number> }
let memo: { at: number; value: EuroRates } | null = null;

export async function officialEuroRates(): Promise<EuroRates | null> {
  if (memo && Date.now() - memo.at < 12 * 60 * 60_000) return memo.value;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", { signal: controller.signal, headers: { Accept: "application/xml" } });
    clearTimeout(timer);
    if (!response.ok) return null;
    const xml = await response.text();
    const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
    if (!date) return null;
    const rates: Record<string, number> = { EUR: 1 };
    for (const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) rates[match[1]!] = Number(match[2]);
    memo = { at: Date.now(), value: { date, rates } };
    return memo.value;
  } catch { return null; }
}

export function toEur(value: number | null, currency: string | null, rates: EuroRates | null): number | null {
  if (value == null || !currency || !rates) return null;
  const rate = rates.rates[currency];
  return rate && rate > 0 ? Math.round((value / rate) * 100) / 100 : null;
}
