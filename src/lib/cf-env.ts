// Cloudflare only copies text bindings (vars/secrets) into process.env; binding objects such as the
// D1 database never appear there. server.ts records the runtime env per request so code can read
// any binding through cfBinding(), falling back to process.env for text values and local dev.
let runtimeEnv: Record<string, unknown> = {};

export function setCfEnv(env: unknown) {
  if (env && typeof env === "object") runtimeEnv = env as Record<string, unknown>;
}

export function cfBinding<T = unknown>(name: string): T | undefined {
  return (runtimeEnv[name] ?? (process.env as Record<string, unknown>)[name]) as T | undefined;
}
