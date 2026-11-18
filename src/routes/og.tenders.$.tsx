import { createFileRoute } from "@tanstack/react-router";
import { cfBinding } from "@/lib/cf-env";
import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import fontData from "@/assets/atlas-sans.ttf?inline";
import wasmUrl from "@resvg/resvg-wasm/index_bg.wasm?url";
import { fetchNotice } from "@/lib/procurement/sources";
import { storedNotice, type AtlasEnv } from "@/lib/procurement/store";
import { SOURCES, countryByIso3 } from "@/lib/procurement/catalog";
import { fmtDate, fmtMoney } from "@/components/atlas/format";

const COLOR = { background: "#f5f3ed", ink: "#17263e", muted: "#596579", accent: "#b64b2a", paper: "#fffdf8", line: "#d9d5ca" };
let wasmReady: Promise<unknown> | undefined;
const bytes = async (dataUri: string) => (await fetch(dataUri)).arrayBuffer();
const assetBytes = async (url: string, request: Request) => (await fetch(url.startsWith("data:") ? url : new URL(url, request.url))).arrayBuffer();
const money = (value: number | null, currency: string | null) => value == null ? "Value not disclosed" : fmtMoney(value, currency) ?? "Value not disclosed";

export const Route = createFileRoute("/og/tenders/$")({
  server: { handlers: { GET: async ({ params, request }) => {
    const segments = (params._splat ?? "").split("/");
    const source = segments.shift() ?? "";
    const filename = segments.join("/");
    const id = filename.endsWith(".png") ? filename.slice(0, -4) : "";
    if (!source || !id) return new Response("Not found", { status: 404 });
    const env: AtlasEnv = { DB: cfBinding("DB") as unknown as AtlasEnv["DB"], SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"] };
    const notice = await fetchNotice(source, id, env) ?? await storedNotice(source, id, env.DB);
    if (!notice) {
      console.warn("Social card notice not found", { source, id });
      return new Response("Not found", { status: 404 });
    }
    try {
      if (!wasmReady) wasmReady = assetBytes(wasmUrl, request).then(initWasm);
      try {
        await wasmReady;
      } catch (error) {
        // Development reloads can re-evaluate this module while the WASM instance survives.
        if (error instanceof Error && error.message.includes("Already initialized")) wasmReady = Promise.resolve();
        else { wasmReady = undefined; throw error; }
      }
      const country = countryByIso3(notice.country)?.name ?? notice.countryName ?? notice.country ?? "Location not disclosed";
      const svg = await satori(<div style={{ width: "1200px", height: "630px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px", background: COLOR.background, color: COLOR.ink, fontFamily: "Atlas Sans" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 25, fontWeight: 600, letterSpacing: "1px" }}>TenderAtlas</div>
          <div style={{ display: "flex", padding: "10px 16px", background: COLOR.ink, color: COLOR.paper, fontSize: 17 }}>{SOURCES[notice.source].label}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "20px" }}>
          <div style={{ display: "flex", color: COLOR.accent, fontSize: 17, textTransform: "uppercase", letterSpacing: "3px", marginBottom: "18px" }}>Official public tender</div>
          <div style={{ display: "flex", fontSize: notice.title.length > 130 ? 34 : 42, lineHeight: 1.15, fontWeight: 600, maxHeight: "205px", overflow: "hidden" }}>{notice.title.slice(0, 220)}</div>
          <div style={{ display: "flex", fontSize: 22, color: COLOR.muted, marginTop: "22px", maxWidth: "1010px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{notice.buyer ?? "Buyer not disclosed"}</div>
        </div>
        <div style={{ display: "flex", borderTop: `2px solid ${COLOR.line}`, paddingTop: "24px", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: 14, color: COLOR.muted, textTransform: "uppercase", letterSpacing: "2px" }}>Deadline</div><div style={{ display: "flex", fontSize: 25, marginTop: "7px" }}>{notice.deadlineAt ? fmtDate(notice.deadlineAt) : "Not disclosed"}</div></div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: "36px" }}><div style={{ display: "flex", fontSize: 14, color: COLOR.muted, textTransform: "uppercase", letterSpacing: "2px" }}>Estimated value</div><div style={{ display: "flex", fontSize: 25, marginTop: "7px" }}>{money(notice.value, notice.currency)}</div></div>
          <div style={{ display: "flex", fontSize: 18, color: COLOR.muted, marginLeft: "auto" }}>{country}</div>
        </div>
      </div>, { width: 1200, height: 630, fonts: [{ name: "Atlas Sans", data: await bytes(fontData), weight: 400, style: "normal" }] });
      const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, background: COLOR.background }).render().asPng();
      return new Response(png.slice().buffer as ArrayBuffer, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
    } catch (error) {
      console.error("Social card rendering failed", error);
      return new Response("Social card unavailable", { status: 503 });
    }
  } } },
});
