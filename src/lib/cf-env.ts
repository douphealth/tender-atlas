// Cloudflare only copies text bindings (vars/secrets) into process.env; binding objects such as the
// D1 database never appear there. server.ts records the runtime env per request so code can read
// any binding through cfBinding(), falling back to process.env for text values and local dev.
// Stored on globalThis because the server entry and the SSR app are bundled separately, so a
// module-level variable would exist twice.
const KEY = "__tenderAtlasCfEnv";
type Holder = { [KEY]?: Record<string, unknown> };

export function setCfEnv(env: unknown) {
  if (env && typeof env === "object") (globalThis as Holder)[KEY] = env as Record<string, unknown>;
}

export function cfBinding<T = unknown>(name: string): T | undefined {
  const g = globalThis as Holder & { __env__?: Record<string, unknown> };
  // Nitro's Cloudflare runtime publishes the real env on globalThis.__env__ for every request.
  return (g.__env__?.[name] ?? g[KEY]?.[name] ?? (process.env as Record<string, unknown>)[name]) as T | undefined;
}
