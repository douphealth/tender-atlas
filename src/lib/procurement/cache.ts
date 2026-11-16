// Small per-isolate memo cache so repeated page views don't hammer official publishers.
const store = new Map<string, { at: number; value: unknown }>();
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  store.set(key, { at: Date.now(), value });
  if (store.size > 500) store.delete(store.keys().next().value as string);
  return value;
}
