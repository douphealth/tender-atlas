import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { availability, createDossierCheckout, dossierStatus, orderInput, orderableNotice, type DossierEnv } from "./checkout";
import { DOSSIER_OFFER, validDossierPrice } from "./offer";
import { handleDossierWebhook, paidSessionMatches, verifyStripeSignature } from "./webhook";
import type { D1Database } from "../procurement/store";
import type { Notice } from "../procurement/sources";

vi.mock("../procurement/sources", () => ({ fetchNotice: vi.fn() }));
vi.mock("../procurement/store", () => ({ storedNotice: vi.fn() }));
vi.mock("../notifications", () => ({ verifyTurnstile: vi.fn().mockResolvedValue(true), tokenHash: vi.fn().mockResolvedValue("hashed-private-token"), sendEmail: vi.fn().mockResolvedValue(true), emailLayout: (_: string, body: string) => body, escapeHtml: (s: string) => s }));
import { fetchNotice } from "../procurement/sources";
import { verifyTurnstile } from "../notifications";

const orderId = "e59a6d7c-5d8c-41d0-9923-4d78f9d652d8";
const data = { source: "uk", noticeId: "official-123", company: "Test Supplier", email: "buyer@example.com", focus: "Lot 1", termsAccepted: true, orderId, accessToken: "a".repeat(64), turnstileToken: "test-only", website: "" };
const price = { id: "price_test", active: true, type: "one_time", currency: "eur", unit_amount: 29000, recurring: null, tax_behavior: "exclusive" };
const notice = { source: "uk", noticeId: "official-123", title: "Official procurement", stage: "competition", status: "open", url: "https://www.find-tender.service.gov.uk/Notice/123", deadlineAt: new Date(Date.now() + 30 * 86400000).toISOString() } as Notice;
const session = { id: "cs_test", mode: "payment", payment_status: "paid", amount_subtotal: 29000, currency: "eur", metadata: { requestId: orderId, offerVersion: DOSSIER_OFFER.version } };
const storedOrder = { id: orderId, stripe_session_id: "cs_test", offer_version: DOSSIER_OFFER.version, expected_amount: 29000, currency: "eur", owner_notified_at: null };
function fakeDb(first: (sql: string, values: unknown[]) => unknown = () => null) {
  const writes: { sql: string; values: unknown[] }[] = [];
  const db: D1Database = { prepare(sql) {
    let values: unknown[] = [];
    const statement = { bind(...args: unknown[]) { values = args; return statement; }, async first<T>() { return first(sql, values) as T | null; }, async all<T>() { return { results: [] as T[] }; }, async run() { writes.push({ sql, values }); return {}; } };
    return statement;
  }, async batch(statements) { return Promise.all(statements.map((s) => s.run())); } };
  return { db, writes };
}
function environment(db: D1Database): DossierEnv { return { DB: db, DOSSIER_SALES_OPEN: "true", STRIPE_AUTOMATIC_TAX: "true", STRIPE_SECRET_KEY: "test-key-not-real", STRIPE_PRICE_ID: "price_test", TURNSTILE_SECRET_KEY: "test-only", STRIPE_WEBHOOK_SECRET: "test-only", RESEND_API_KEY: "test-only", NOTIFICATION_FROM_EMAIL: "seller@example.com", NOTIFICATION_TO_EMAIL: "owner@example.com" }; }
function request(body: unknown = data, origin = "https://atlas.example") { return new Request("https://atlas.example/api/public/stripe/checkout", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.mocked(verifyTurnstile).mockResolvedValue(true); });

async function signed(raw: string, timestamp = Math.floor(Date.now() / 1000)) {
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${raw}`));
  return `t=${timestamp},v1=${Buffer.from(sig).toString("hex")}`;
}

describe("Dossier pilot rules", () => {
  it("charges the delegated €290 once in EUR", () => { expect(DOSSIER_OFFER.amount).toBe(29000); expect(DOSSIER_OFFER.currency).toBe("eur"); expect(validDossierPrice(price, "price_test")).toBe(true); });
  it("sets two working days as the delivery period", () => { expect(DOSSIER_OFFER.deliveryWorkingDays).toBe(2); });
  it.each([{ unit_amount: 49000 }, { currency: "usd" }, { active: false }, { tax_behavior: "inclusive" }, { type: "recurring", recurring: {} }])("rejects a mismatched or recurring price %j", (change) => { expect(validDossierPrice({ ...price, ...change }, "price_test")).toBe(false); });
  it("requires consent and rejects caller-supplied pricing", () => { expect(orderInput.safeParse({ ...data, termsAccepted: false }).success).toBe(false); expect(orderInput.safeParse({ ...data, amount: 1 }).success).toBe(false); });
  it("requires an open competition with more than four days to a disclosed deadline", () => { expect(orderableNotice(notice)).toBe(true); expect(orderableNotice({ ...notice, deadlineAt: null })).toBe(false); expect(orderableNotice({ ...notice, deadlineAt: new Date(Date.now() + 86400000).toISOString() })).toBe(false); expect(orderableNotice({ ...notice, stage: "award" })).toBe(false); });
  it("stays closed without owner activation", async () => { expect((await availability({ ...environment(fakeDb().db), DOSSIER_SALES_OPEN: undefined })).available).toBe(false); });
});

describe("Secure checkout", () => {
  it("rejects cross-origin requests and the old unauthorised intake-ID path", async () => { expect((await createDossierCheckout(request(data, "https://elsewhere.example"), {})).status).toBe(403); expect((await createDossierCheckout(request({ requestId: orderId }), {})).status).toBe(400); });
  it("stores official data and uses server price and stable idempotency", async () => {
    const { db, writes } = fakeDb(); vi.mocked(fetchNotice).mockResolvedValue(notice);
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(price)).mockResolvedValueOnce(Response.json({ id: "cs_test", url: "https://checkout.stripe.com/c/pay/test" })); vi.stubGlobal("fetch", fetchMock);
    const response = await createDossierCheckout(request(), environment(db));
    expect(response.status).toBe(200); expect((await response.json()).url).toBe("https://checkout.stripe.com/c/pay/test");
    expect(writes.find((w) => w.sql.startsWith("INSERT INTO dossier_requests"))?.values[1]).toBe(notice.url);
    expect(writes.find((w) => w.sql.startsWith("INSERT INTO dossier_orders"))?.values[1]).toBe("hashed-private-token");
    const call = fetchMock.mock.calls[1]; const options = call?.[1] as RequestInit;
    expect((options.headers as Record<string, string>)["Idempotency-Key"]).toBe(`dossier-${orderId}`);
    const body = new URLSearchParams(String(options.body)); expect(body.get("line_items[0][price]")).toBe("price_test"); expect(body.get("automatic_tax[enabled]")).toBe("true"); expect(body.get("success_url")).not.toContain(data.accessToken);
  });
  it("does not create orders after failed anti-spam verification", async () => {
    const { db, writes } = fakeDb(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(price))); vi.mocked(verifyTurnstile).mockResolvedValue(false);
    expect((await createDossierCheckout(request(), environment(db))).status).toBe(403); expect(writes).toHaveLength(0);
  });
  it("reuses an existing checkout without creating a second session", async () => {
    const { db, writes } = fakeDb((sql) => sql.includes("access_token_hash") ? { access_token_hash: "hashed-private-token", checkout_url: "https://checkout.stripe.com/c/pay/test", payment_status: "pending" } : null);
    const fetchMock = vi.fn().mockResolvedValue(Response.json(price)); vi.stubGlobal("fetch", fetchMock);
    expect((await createDossierCheckout(request(), environment(db))).status).toBe(200); expect(fetchMock).toHaveBeenCalledTimes(1); expect(writes).toHaveLength(0);
  });
  it("requires a private capability to read status", async () => { expect((await dossierStatus(new Request(`https://atlas.example/api?order=${orderId}`), {})).status).toBe(401); });
});

describe("Verified fulfilment", () => {
  it("checks session, price, currency and offer before marking paid", () => { expect(paidSessionMatches(session, storedOrder)).toBe(true); expect(paidSessionMatches({ ...session, amount_subtotal: 1 }, storedOrder)).toBe(false); expect(paidSessionMatches({ ...session, id: "cs_wrong" }, storedOrder)).toBe(false); expect(paidSessionMatches({ ...session, currency: "usd" }, storedOrder)).toBe(false); });
  it("accepts a valid rotated signature but rejects tampering and stale signatures", async () => { vi.stubGlobal("crypto", webcrypto); const raw = '{"id":"evt_test"}'; const signature = await signed(raw); expect(await verifyStripeSignature(raw, `${signature},v1=${"0".repeat(64)}`, "test-secret")).toBe(true); expect(await verifyStripeSignature(`${raw} `, signature, "test-secret")).toBe(false); expect(await verifyStripeSignature(raw, await signed(raw, Math.floor(Date.now() / 1000) - 600), "test-secret")).toBe(false); });
  it("queues a signed paid event and returns its status through private readback", async () => {
    vi.stubGlobal("crypto", webcrypto); let paid = false;
    const { db, writes } = fakeDb((sql) => sql.includes("SELECT * FROM dossier_orders") ? storedOrder : sql.includes("SELECT payment_status") ? { payment_status: paid ? "paid" : "pending" } : null);
    const raw = JSON.stringify({ id: "evt_test", type: "checkout.session.async_payment_succeeded", data: { object: session } });
    const response = await handleDossierWebhook(new Request("https://atlas.example/webhook", { method: "POST", headers: { "stripe-signature": await signed(raw) }, body: raw }), { DB: db, STRIPE_WEBHOOK_SECRET: "test-secret" });
    expect(response.status).toBe(200); paid = writes.some((w) => w.sql.includes("SET payment_status = 'paid'")); expect(paid).toBe(true);
    const status = await dossierStatus(new Request(`https://atlas.example/api?order=${orderId}`, { headers: { Authorization: `Bearer ${data.accessToken}` } }), { DB: db }); expect((await status.json()).status).toBe("paid");
  });
  it("does not mark an unpaid completed session paid", async () => {
    vi.stubGlobal("crypto", webcrypto); const { db, writes } = fakeDb(); const raw = JSON.stringify({ id: "evt_unpaid", type: "checkout.session.completed", data: { object: { ...session, payment_status: "unpaid" } } });
    expect((await handleDossierWebhook(new Request("https://atlas.example/webhook", { method: "POST", headers: { "stripe-signature": await signed(raw) }, body: raw }), { DB: db, STRIPE_WEBHOOK_SECRET: "test-secret" })).status).toBe(200); expect(writes).toHaveLength(0);
  });
});

describe("flat price without Stripe Tax", () => {
  it("accepts an unspecified-tax price only when automatic tax is off", async () => {
    const { validDossierPrice } = await import("./offer");
    const price = { id: "price_x", active: true, type: "one_time", currency: "eur", unit_amount: 29000, tax_behavior: "unspecified" };
    expect(validDossierPrice(price, "price_x", false)).toBe(true);
    expect(validDossierPrice(price, "price_x", true)).toBe(false);
  });
});
