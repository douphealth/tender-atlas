import { setCfEnv } from "./lib/cf-env";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { seoPreflight, seoRewrite } from "./lib/seo-edge";
import { withEdgeCache } from "./lib/edge-cache";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Hosting compresses every response at the edge. Never compress a body (gzip, brotli,
// CompressionStream) or set content-encoding here or in a server route: the body gets encoded
// twice and renders garbled.
export default {
  async scheduled(event: { cron: string }, env: unknown, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    setCfEnv(env);
    const { ingestIncremental, sendDueAlerts } = await import("./lib/scheduled");
    ctx.waitUntil((async () => {
      const environment = env as Parameters<typeof ingestIncremental>[0];
      if (event.cron.startsWith("17")) await ingestIncremental(environment);
      else await sendDueAlerts(environment);
    })().catch((error) => console.error("Scheduled TenderAtlas job failed", error)));
  },
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Nitro may pass the Cloudflare env as the 2nd argument or attach it to the request (srvx runtime).
    const r = request as Request & { runtime?: { cloudflare?: { env?: unknown } }; context?: { cloudflare?: { env?: unknown } } };
    setCfEnv((env && typeof env === "object" && "DB" in (env as object)) ? env : (r.runtime?.cloudflare?.env ?? r.context?.cloudflare?.env ?? env));
    const redirect = seoPreflight(request);
    if (redirect) return redirect;
    try {
      // Public pages are cached at the edge for 300s (see lib/edge-cache.ts).
      return await withEdgeCache(request, ctx, { ttl: 300, skip: (p) => /^\/(api|app|alerts)(\/|$)/.test(p) }, async () => {
        const handler = await getServerEntry();
        const response = await handler.fetch(request, env, ctx);
        return seoRewrite(request, await normalizeCatastrophicSsrResponse(response));
      });
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
