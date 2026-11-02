import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { app } from "../worker/index";
import type { Env } from "../worker/env";
import type { D1Database } from "@cloudflare/workers-types";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
const ownerToken = "test-only-local-administrator-token-123456789";
let sql: DatabaseSync;
let env: Env;
// SQLite executes the actual migration and parameterized queries; the thin facade
// emulates D1's return envelope and transactional batch, not application behavior.
function database(): D1Database {
  let tail = Promise.resolve();
  function prepare(query: string) {
    let values: unknown[] = [];
    return {
      bind(...args: unknown[]) {
        values = args;
        return this;
      },
      async first(column?: string) {
        const row = sql.prepare(query).get(...(values as never[])) ?? null;
        return column && row ? row[column] : row;
      },
      async all() {
        return {
          results: sql.prepare(query).all(...(values as never[])),
          success: true,
          meta: {},
        };
      },
      async run() {
        const r = sql.prepare(query).run(...(values as never[]));
        return { success: true, meta: { changes: r.changes }, results: [] };
      },
    };
  }
  return {
    prepare,
    async batch(statements: Array<ReturnType<typeof prepare>>) {
      let unlock!: () => void;
      const previous = tail;
      tail = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      await previous;
      sql.exec("BEGIN");
      try {
        const r = [];
        for (const s of statements) r.push(await s.run());
        sql.exec("COMMIT");
        return r;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      } finally {
        unlock();
      }
    },
  } as unknown as D1Database;
}
function input() {
  return {
    idempotencyKey: crypto.randomUUID(),
    customer: {
      name: "Test Customer",
      email: "customer@example.test",
      phone: "8135550123",
    },
    property: {
      address: "Test property, Tampa FL",
      lat: 27.95,
      lng: -82.45,
      placeId: "test-place",
    },
    areas: [
      {
        id: "area-1",
        service: "driveway",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-82.45, 27.95],
              [-82.4499, 27.95],
              [-82.4499, 27.9501],
              [-82.45, 27.9501],
              [-82.45, 27.95],
            ],
          ],
        },
      },
    ],
    conditions: [],
    notes: "Please call first",
    preferredDate: "",
    timeWindow: "",
    accessInstructions: "Side gate",
    consent: true,
    website: "",
  };
}
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  admin = false,
  headers: Record<string, string> = {},
) {
  return (await app.request(
    `http://localhost${path}`,
    {
      method,
      headers: {
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
        ...(admin ? { "X-Local-Admin-Token": ownerToken } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  )) as unknown as {
    status: number;
    json(): Promise<any>;
    text(): Promise<string>;
  };
}
beforeEach(() => {
  sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../migrations/0001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  env = {
    DB: database(),
    APP_ENV: "local",
    APP_URL: "http://localhost",
    EMAIL_MODE: "preview",
    LOCAL_ADMIN_TOKEN: ownerToken,
  };
});
afterEach(() => {
  sql.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("quote API and actual SQLite persistence", () => {
  it("stores a server-verified quote, its geometry and two preview emails", async () => {
    const payload = input();
    const r = await request("/api/quotes", "POST", payload);
    expect(r.status).toBe(201);
    const saved = await r.json();
    expect(saved.quoteNumber).toMatch(/^ROS-\d{8}-[A-F0-9]{12}$/);
    expect(saved.estimate.totalCents).toBeGreaterThanOrEqual(15000);
    expect(saved.emails).toEqual({ customer: "preview", business: "preview" });
    const detail = await (
      await request(`/api/admin/quotes/${saved.id}`, "GET", undefined, true)
    ).json();
    expect(detail.quote.areas).toEqual(payload.areas);
    expect(detail.emails).toHaveLength(2);
    expect(sql.prepare("SELECT COUNT(*) n FROM email_attempts").get()?.n).toBe(
      2,
    );
  });
  it("ignores price and measurement tampering from the browser", async () => {
    const payload = {
      ...input(),
      totalCents: 1,
      squareFeet: 1,
      estimate: { totalCents: 1 },
    };
    const r = await request("/api/quotes", "POST", payload);
    expect(r.status).toBe(201);
    const q = await r.json();
    expect(q.estimate.totalCents).toBeGreaterThanOrEqual(15000);
    expect(q.estimate.totalSquareFeet).toBeGreaterThan(1000);
  });
  it("returns the same quote for repeated identical submissions", async () => {
    const p = input();
    const first = await (await request("/api/quotes", "POST", p)).json();
    const response = await request("/api/quotes", "POST", {
      ...p,
      turnstileToken: "renewed-token",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe(first.id);
    expect(sql.prepare("SELECT COUNT(*) n FROM quotes").get()?.n).toBe(1);
    expect(sql.prepare("SELECT COUNT(*) n FROM email_records").get()?.n).toBe(
      2,
    );
  });
  it("rejects reuse of a submission key for changed details", async () => {
    const p = input();
    await request("/api/quotes", "POST", p);
    expect(
      (await request("/api/quotes", "POST", { ...p, notes: "Changed details" }))
        .status,
    ).toBe(409);
  });
  it.each([
    { customer: { name: "A", email: "invalid", phone: "bad" } },
    { consent: false },
    { website: "spam.example" },
    { conditions: ["Unsupported condition"] },
    { preferredDate: "2026-02-30" },
  ])("rejects invalid input %j", async (patch) => {
    expect(
      (await request("/api/quotes", "POST", { ...input(), ...patch })).status,
    ).toBe(400);
    expect(sql.prepare("SELECT COUNT(*) n FROM quotes").get()?.n).toBe(0);
  });
  it("rejects unrelated geography", async () => {
    const p = input();
    p.property.lat = 30;
    expect((await request("/api/quotes", "POST", p)).status).toBe(400);
  });
  it("marks special conditions for review without inventing a surcharge", async () => {
    const p = input();
    const normal = await (await request("/api/estimate", "POST", p)).json();
    const response = await request("/api/quotes", "POST", {
      ...p,
      conditions: ["Rust stains"],
    });
    const saved = await response.json();
    expect(saved.status).toBe("needs_review");
    expect(saved.estimate.totalCents).toBe(normal.totalCents);
  });
  it("preserves saved data when live email is unconfigured and supports safe retries", async () => {
    env.EMAIL_MODE = "live";
    const r = await request("/api/quotes", "POST", input());
    expect(r.status).toBe(201);
    const q = await r.json();
    expect(q.emails).toEqual({ customer: "failed", business: "failed" });
    env.EMAIL_MODE = "preview";
    const retry = await request(
      `/api/admin/quotes/${q.id}/retry-emails`,
      "POST",
      undefined,
      true,
    );
    expect(retry.status).toBe(200);
    const detail = await retry.json();
    expect(
      detail.emails.every((e: { status: string }) => e.status === "preview"),
    ).toBe(true);
    expect(sql.prepare("SELECT COUNT(*) n FROM quotes").get()?.n).toBe(1);
  });
  it("enforces status changes and protects private notes from public responses/emails", async () => {
    const p = input();
    const q = await (await request("/api/quotes", "POST", p)).json();
    expect(
      (
        await request(
          `/api/admin/quotes/${q.id}`,
          "PATCH",
          { status: "scheduled", privateNotes: "PRIVATE OWNER NOTE" },
          true,
        )
      ).status,
    ).toBe(200);
    const detail = await (
      await request(`/api/admin/quotes/${q.id}`, "GET", undefined, true)
    ).json();
    expect(detail.quote.status).toBe("scheduled");
    expect(detail.quote.privateNotes).toBe("PRIVATE OWNER NOTE");
    const receipt = await (await request("/api/quotes", "POST", p)).text();
    expect(receipt).not.toContain("PRIVATE OWNER NOTE");
    expect(receipt).not.toContain("customer@example.test");
    expect(
      detail.emails.map((e: { html: string }) => e.html).join(""),
    ).not.toContain("PRIVATE OWNER NOTE");
  });
  it("deletes a quote and cascades outlines and email records", async () => {
    const q = await (await request("/api/quotes", "POST", input())).json();
    expect(
      (await request(`/api/admin/quotes/${q.id}`, "DELETE", undefined, true))
        .status,
    ).toBe(200);
    for (const table of [
      "quotes",
      "cleaning_areas",
      "email_records",
      "email_attempts",
    ])
      expect(sql.prepare(`SELECT COUNT(*) n FROM ${table}`).get()?.n).toBe(0);
  });
  it("summarizes, filters and exports records safely for spreadsheets", async () => {
    const p = input();
    p.customer.name = "=DANGEROUS FORMULA";
    await request("/api/quotes", "POST", p);
    const summary = await (
      await request("/api/admin/summary", "GET", undefined, true)
    ).json();
    expect(summary.total).toBe(1);
    const filtered = await (
      await request("/api/admin/quotes?search=missing", "GET", undefined, true)
    ).json();
    expect(filtered.quotes).toEqual([]);
    const csv = await (
      await request("/api/admin/export.csv", "GET", undefined, true)
    ).text();
    expect(csv).toContain("'=DANGEROUS FORMULA");
  });
});
describe("access and abuse protection", () => {
  it.each([
    "/api/admin/summary",
    "/api/admin/quotes",
    "/api/admin/export.csv",
    "/api/admin/contacts",
    "/api/admin/quotes/unknown",
  ])("denies anonymous access to %s", async (path) => {
    expect((await request(path)).status).toBe(401);
  });
  it("rejects a wrong local token", async () => {
    expect(
      (
        await request("/api/admin/quotes", "GET", undefined, false, {
          "X-Local-Admin-Token": "wrong",
        })
      ).status,
    ).toBe(401);
  });
  it("never enables local admin authentication on a public hostname", async () => {
    const r = await app.request(
      "https://site.example/api/admin/quotes",
      { headers: { "X-Local-Admin-Token": ownerToken } },
      env,
    );
    expect(r.status).toBe(503);
  });
  it("fails closed when production Access is unconfigured", async () => {
    env.APP_ENV = "production";
    expect((await request("/api/admin/quotes")).status).toBe(503);
  });
  it("fails closed when public submission verification is unconfigured", async () => {
    env.APP_ENV = "production";
    expect((await request("/api/quotes", "POST", input())).status).toBe(503);
    expect(sql.prepare("SELECT COUNT(*) n FROM quotes").get()?.n).toBe(0);
  });
  it("rejects cross-origin mutations", async () => {
    expect(
      (
        await request("/api/quotes", "POST", input(), false, {
          Origin: "https://attacker.example",
        })
      ).status,
    ).toBe(403);
  });
  it("limits repeated submission attempts", async () => {
    for (let i = 0; i < 15; i++) await request("/api/quotes", "POST", {});
    expect((await request("/api/quotes", "POST", {})).status).toBe(429);
  });
  it("verifies signed Access JWT audience issuer and owner email", async () => {
    env.APP_ENV = "production";
    env.ACCESS_TEAM_DOMAIN = "test-rosalutions.cloudflareaccess.com";
    env.ACCESS_AUD = "owner-app";
    env.ADMIN_EMAIL = "owner@example.test";
    const keys = await generateKeyPair("RS256");
    const publicKey = await exportJWK(keys.publicKey);
    Object.assign(publicKey, { kid: "test-key", alg: "RS256", use: "sig" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ keys: [publicKey] }), {
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    async function token(email: string, aud = "owner-app") {
      return new SignJWT({ email })
        .setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setIssuer("https://test-rosalutions.cloudflareaccess.com")
        .setAudience(aud)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(keys.privateKey);
    }
    expect(
      (
        await request("/api/admin/summary", "GET", undefined, false, {
          "Cf-Access-Jwt-Assertion": await token("owner@example.test"),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request("/api/admin/summary", "GET", undefined, false, {
          "Cf-Access-Jwt-Assertion": await token("stranger@example.test"),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request("/api/admin/summary", "GET", undefined, false, {
          "Cf-Access-Jwt-Assertion": await token("owner@example.test", "wrong"),
        })
      ).status,
    ).toBe(401);
  });
  it("verifies Turnstile hostname and geocodes the selected property in production", async () => {
    env.APP_ENV = "production";
    env.TURNSTILE_SITE_KEY = "test-site";
    env.TURNSTILE_SECRET_KEY = "test-secret";
    env.GOOGLE_MAPS_SERVER_KEY = "test-server-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("turnstile")
          ? Response.json({ success: true, hostname: "localhost" })
          : Response.json({
              status: "OK",
              results: [
                {
                  formatted_address: "Verified property address",
                  types: ["street_address"],
                  geometry: { location: { lat: 27.95, lng: -82.45 } },
                },
              ],
            }),
      ),
    );
    const r = await request("/api/quotes", "POST", {
      ...input(),
      turnstileToken: "test-token",
    });
    expect(r.status).toBe(201);
    expect(
      JSON.parse(
        String(
          sql.prepare("SELECT property_json FROM quotes").get()?.property_json,
        ),
      ).address,
    ).toBe("Verified property address");
  });
});
describe("contact workflow", () => {
  it("persists a contact, sends preview, retries without duplication, then deletes", async () => {
    const p = {
      idempotencyKey: crypto.randomUUID(),
      name: "Test Customer",
      email: "test@example.test",
      phone: "8135550123",
      subject: "Fence cleaning",
      message: "Please help clean the test fence.",
      consent: true,
      website: "",
    };
    const first = await (await request("/api/contact", "POST", p)).json();
    expect(first.emailStatus).toBe("preview");
    const repeat = await (await request("/api/contact", "POST", p)).json();
    expect(repeat.id).toBe(first.id);
    expect(
      (
        await request(
          `/api/admin/contacts/${first.id}/retry-email`,
          "POST",
          undefined,
          true,
        )
      ).status,
    ).toBe(200);
    const list = await (
      await request("/api/admin/contacts", "GET", undefined, true)
    ).json();
    expect(list.contacts).toHaveLength(1);
    expect(
      (
        await request(
          `/api/admin/contacts/${first.id}`,
          "DELETE",
          undefined,
          true,
        )
      ).status,
    ).toBe(200);
    expect(sql.prepare("SELECT COUNT(*) n FROM email_records").get()?.n).toBe(
      0,
    );
  });
});
