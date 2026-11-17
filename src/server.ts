import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

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
function withNoindex(response: Response): Response {
  if (response.status !== 404 && response.status !== 500) return response;
  if (response.headers.get("X-Robots-Tag")?.includes("noindex")) return response;
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, follow");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async scheduled(event: { cron: string }, env: unknown, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    const { ingestIncremental, sendDueAlerts } = await import("./lib/scheduled");
    ctx.waitUntil((async () => {
      const environment = env as Parameters<typeof ingestIncremental>[0];
      if (event.cron.startsWith("17")) await ingestIncremental(environment);
      else await sendDueAlerts(environment);
    })().catch((error) => console.error("Scheduled TenderAtlas job failed", error)));
  },
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withNoindex(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withNoindex(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },
};
