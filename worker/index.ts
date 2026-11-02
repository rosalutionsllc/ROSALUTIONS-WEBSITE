import { PAGE_META } from "../shared/seo";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import type { Env } from "./env";
import type { QuoteRecord } from "../shared/types";
import { roundMeasuredCents, calculateEstimate } from "../shared/pricing";
import { validateAndMeasureAreas } from "../shared/geometry";
import { getPricing, getPublicConfig } from "./config";
import {
  quoteSchema,
  contactSchema,
  estimateSchema,
  updateSchema,
  statusSchema,
} from "./validation";
import {
  ApiError,
  adminAuth,
  isLocal,
  rateLimit,
  requestHash,
  safeOrigin,
  verifyProperty,
  verifyTurnstile,
} from "./security";
import {
  emailRecords,
  hydrateQuotes,
  loadQuote,
  receipt,
  type QuoteRow,
} from "./storage";
import { renderContactEmail, renderQuoteEmail } from "./email";
import { deliverOutbox, deliverQuoteEmails } from "./outbox";

export const app = new Hono<{ Bindings: Env }>();
app.use(
  "*",
  secureHeaders({
    referrerPolicy: "strict-origin-when-cross-origin",
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
  }),
);
app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Robots-Tag", "noindex, nofollow");
  await next();
});
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 128 * 1024,
    onError: (c) => c.json({ error: "Request is too large." }, 413),
  }),
);
app.use("/api/*", safeOrigin);
app.use("/api/admin/*", adminAuth);
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return c.json(
      {
        error: "Please check the submitted details.",
        fields: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      400,
    );
  if (error instanceof SyntaxError)
    return c.json({ error: "Invalid request data." }, 400);
  if (
    ["GeometryValidationError", "PricingValidationError"].includes(error.name)
  )
    return c.json({ error: error.message }, 400);
  // Do not log bodies, customer information, provider payloads, or credentials.
  return c.json(
    {
      error:
        "The request could not be completed. Please try again or contact Rosalutions.",
    },
    500,
  );
});
app.get("/api/config", (c) => c.json(getPublicConfig(c.env)));
app.post("/api/estimate", async (c) => {
  await rateLimit(c, "estimate", 90, 60);
  const input = estimateSchema.parse(await c.req.json());
  return c.json(
    calculateEstimate(
      input.areas,
      input.property,
      getPricing(c.env),
      input.conditions,
    ),
  );
});
app.post("/api/quotes", async (c) => {
  await rateLimit(c, "quote", 15, 3600);
  const input = quoteSchema.parse(await c.req.json());
  const hash = await requestHash(input);
  const existing = await c.env.DB.prepare(
    "SELECT * FROM quotes WHERE idempotency_key=?",
  )
    .bind(input.idempotencyKey)
    .first<QuoteRow>();
  if (existing) {
    if (existing.request_hash !== hash)
      throw new ApiError(
        409,
        "This submission was already used for different details. Start a new request.",
      );
    return c.json(receipt((await hydrateQuotes(c.env, [existing]))[0]));
  }
  await verifyTurnstile(c, input.turnstileToken);
  const property = await verifyProperty(c, input.property);
  const pricing = getPricing(c.env);
  const estimate = calculateEstimate(
    input.areas,
    property,
    pricing,
    input.conditions,
  );
  const measured = validateAndMeasureAreas(input.areas, property);
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const quoteNumber = `ROS-${timestamp.slice(0, 10).replaceAll("-", "")}-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const quote: QuoteRecord = {
    id,
    quoteNumber,
    customer: input.customer,
    property,
    areas: input.areas,
    conditions: input.conditions,
    notes: input.notes,
    preferredDate: input.preferredDate,
    timeWindow: input.timeWindow,
    accessInstructions: input.accessInstructions,
    status: estimate.needsReview ? "needs_review" : "new",
    privateNotes: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    pricing,
    estimate,
    emails: { customer: "pending", business: "pending" },
  };
  const statements = [
    c.env.DB.prepare(
      `INSERT INTO quotes(id,quote_number,idempotency_key,request_hash,customer_name,customer_email,customer_phone,property_json,estimate_json,pricing_json,conditions_json,notes,preferred_date,time_window,access_instructions,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      id,
      quoteNumber,
      input.idempotencyKey,
      hash,
      input.customer.name,
      input.customer.email,
      input.customer.phone,
      JSON.stringify(property),
      JSON.stringify(estimate),
      JSON.stringify(pricing),
      JSON.stringify(input.conditions),
      input.notes,
      input.preferredDate,
      input.timeWindow,
      input.accessInstructions,
      quote.status,
      timestamp,
      timestamp,
    ),
  ];
  const accumulated: Record<string, number> = {};
  const accumulatedCents: Record<string, number> = {};
  for (const area of measured.areas) {
    accumulated[area.service] =
      (accumulated[area.service] || 0) + area.billableSquareFeet;
    const cents = roundMeasuredCents(
      accumulated[area.service],
      pricing.ratesCents[area.service],
    );
    const contribution = cents - (accumulatedCents[area.service] || 0);
    accumulatedCents[area.service] = cents;
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO cleaning_areas(id,quote_id,service,geometry_json,square_feet,billable_square_feet,contribution_cents) VALUES(?,?,?,?,?,?,?)",
      ).bind(
        area.id,
        id,
        area.service,
        JSON.stringify(area.geometry),
        area.squareFeet,
        area.billableSquareFeet,
        contribution,
      ),
    );
  }
  const config = getPublicConfig(c.env);
  const base = c.env.APP_URL || new URL(c.req.url).origin;
  for (const kind of ["customer", "business"] as const) {
    const rendered = renderQuoteEmail(quote, kind, config, base);
    statements.push(
      c.env.DB.prepare(
        "INSERT INTO email_records(id,quote_id,kind,recipient,subject,html,text_content,reply_to,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        id,
        kind,
        kind === "customer" ? input.customer.email : config.business.email,
        rendered.subject,
        rendered.html,
        rendered.text,
        rendered.replyTo,
        timestamp,
      ),
    );
  }
  try {
    await c.env.DB.batch(statements);
  } catch (error) {
    const raced = await c.env.DB.prepare(
      "SELECT * FROM quotes WHERE idempotency_key=?",
    )
      .bind(input.idempotencyKey)
      .first<QuoteRow>();
    if (raced && raced.request_hash === hash)
      return c.json(receipt((await hydrateQuotes(c.env, [raced]))[0]));
    if (raced)
      throw new ApiError(
        409,
        "This submission was already used for different details.",
      );
    throw error;
  }
  try {
    await deliverQuoteEmails(c.env, id);
  } catch {
    /* The saved request and pending records are recoverable from the owner dashboard. */
  }
  const saved = await loadQuote(c.env, id);
  return c.json(saved ? receipt(saved) : receipt(quote), 201);
});
app.post("/api/contact", async (c) => {
  await rateLimit(c, "contact", 10, 3600);
  const input = contactSchema.parse(await c.req.json());
  const hash = await requestHash(input);
  const duplicate = await c.env.DB.prepare(
    "SELECT id,request_hash FROM contacts WHERE idempotency_key=?",
  )
    .bind(input.idempotencyKey)
    .first<{ id: string; request_hash: string }>();
  if (duplicate) {
    if (duplicate.request_hash !== hash)
      throw new ApiError(
        409,
        "This submission was already used for different details.",
      );
    const record = await c.env.DB.prepare(
      "SELECT status FROM email_records WHERE contact_id=?",
    )
      .bind(duplicate.id)
      .first<{ status: string }>();
    return c.json({
      id: duplicate.id,
      emailStatus: record?.status || "pending",
    });
  }
  await verifyTurnstile(c, input.turnstileToken);
  const id = crypto.randomUUID(),
    emailId = crypto.randomUUID(),
    now = new Date().toISOString();
  const config = getPublicConfig(c.env);
  const rendered = renderContactEmail(
    input,
    config,
    c.env.APP_URL || new URL(c.req.url).origin,
  );
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO contacts(id,idempotency_key,request_hash,name,email,phone,subject,message,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      ).bind(
        id,
        input.idempotencyKey,
        hash,
        input.name,
        input.email,
        input.phone,
        input.subject,
        input.message,
        now,
      ),
      c.env.DB.prepare(
        "INSERT INTO email_records(id,contact_id,kind,recipient,subject,html,text_content,reply_to,updated_at) VALUES(?,?,'contact',?,?,?,?,?,?)",
      ).bind(
        emailId,
        id,
        config.business.email,
        rendered.subject,
        rendered.html,
        rendered.text,
        rendered.replyTo,
        now,
      ),
    ]);
  } catch (error) {
    const raced = await c.env.DB.prepare(
      "SELECT id,request_hash FROM contacts WHERE idempotency_key=?",
    )
      .bind(input.idempotencyKey)
      .first<{ id: string; request_hash: string }>();
    if (raced && raced.request_hash === hash)
      return c.json({ id: raced.id, emailStatus: "pending" });
    if (raced)
      throw new ApiError(
        409,
        "This submission was already used for different details.",
      );
    throw error;
  }
  try {
    await deliverOutbox(c.env, emailId);
  } catch {
    /* Request remains stored. */
  }
  const record = await c.env.DB.prepare(
    "SELECT status FROM email_records WHERE id=?",
  )
    .bind(emailId)
    .first<{ status: string }>();
  return c.json({ id, emailStatus: record?.status || "pending" }, 201);
});
app.get("/api/admin/summary", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) total, COALESCE(SUM(status='new'),0) new, COALESCE(SUM(status='needs_review'),0) needsReview, COALESCE(SUM(json_extract(estimate_json,'$.totalCents')),0) estimatedValueCents FROM quotes`,
  ).first();
  return c.json(row);
});
function filters(query: Record<string, string>) {
  const clauses: string[] = [],
    params: string[] = [];
  if (query.search) {
    clauses.push(
      "(customer_name LIKE ? OR customer_email LIKE ? OR quote_number LIKE ? OR property_json LIKE ?)",
    );
    const needle = `%${query.search.slice(0, 150)}%`;
    params.push(needle, needle, needle, needle);
  }
  if (query.status && statusSchema.safeParse(query.status).success) {
    clauses.push("status=?");
    params.push(query.status);
  }
  if (
    query.service &&
    ["driveway", "sidewalk", "patio"].includes(query.service)
  ) {
    clauses.push(
      "EXISTS(SELECT 1 FROM cleaning_areas a WHERE a.quote_id=quotes.id AND a.service=?)",
    );
    params.push(query.service);
  }
  if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) {
    clauses.push("created_at>=?");
    params.push(query.from);
  }
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
    clauses.push("created_at<=?");
    params.push(`${query.to}T23:59:59.999Z`);
  }
  const orders: Record<string, string> = {
    date_desc: "created_at DESC",
    date_asc: "created_at ASC",
    customer_asc: "customer_name COLLATE NOCASE ASC",
    estimate_desc: "json_extract(estimate_json,'$.totalCents') DESC",
    estimate_asc: "json_extract(estimate_json,'$.totalCents') ASC",
    date: "created_at DESC",
    oldest: "created_at ASC",
    customer: "customer_name COLLATE NOCASE ASC",
    estimate: "json_extract(estimate_json,'$.totalCents') DESC",
    status: "status ASC,created_at DESC",
  };
  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
    order: orders[query.sort] || orders.date,
  };
}
app.get("/api/admin/quotes", async (c) => {
  const f = filters(c.req.query());
  const offset = Math.max(
    0,
    Math.min(100000, Number(c.req.query("offset")) || 0),
  );
  const rows = await c.env.DB.prepare(
    `SELECT * FROM quotes ${f.where} ORDER BY ${f.order} LIMIT 100 OFFSET ?`,
  )
    .bind(...f.params, offset)
    .all<QuoteRow>();
  return c.json({
    quotes: await hydrateQuotes(c.env, rows.results),
    nextOffset: rows.results.length === 100 ? offset + 100 : null,
  });
});
app.get("/api/admin/export.csv", async (c) => {
  const f = filters(c.req.query());
  const rows = await c.env.DB.prepare(
    `SELECT quote_number,customer_name,customer_email,customer_phone,property_json,status,created_at,estimate_json FROM quotes ${f.where} ORDER BY ${f.order} LIMIT 10000`,
  )
    .bind(...f.params)
    .all<
      Pick<
        QuoteRow,
        | "quote_number"
        | "customer_name"
        | "customer_email"
        | "customer_phone"
        | "property_json"
        | "status"
        | "created_at"
        | "estimate_json"
      >
    >();
  const cell = (value: unknown) => {
    let s = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const values = [
    [
      "Quote number",
      "Customer",
      "Email",
      "Phone",
      "Address",
      "Status",
      "Square feet",
      "Estimate USD",
      "Created at",
    ],
    ...rows.results.map((r) => {
      const e = JSON.parse(r.estimate_json);
      return [
        r.quote_number,
        r.customer_name,
        r.customer_email,
        r.customer_phone,
        JSON.parse(r.property_json).address,
        r.status,
        e.totalSquareFeet,
        (e.totalCents / 100).toFixed(2),
        r.created_at,
      ];
    }),
  ];
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header(
    "Content-Disposition",
    'attachment; filename="rosalutions-quotes.csv"',
  );
  return c.body(values.map((r) => r.map(cell).join(",")).join("\r\n"));
});
app.get("/api/admin/quotes/:id", async (c) => {
  const quote = await loadQuote(c.env, c.req.param("id"));
  if (!quote) throw new ApiError(404, "Quote not found.");
  return c.json({ quote, emails: await emailRecords(c.env, quote.id) });
});
app.patch("/api/admin/quotes/:id", async (c) => {
  const update = updateSchema.parse(await c.req.json());
  const result = await c.env.DB.prepare(
    "UPDATE quotes SET status=COALESCE(?,status), private_notes=COALESCE(?,private_notes), updated_at=? WHERE id=? RETURNING id",
  )
    .bind(
      update.status ?? null,
      update.privateNotes ?? null,
      new Date().toISOString(),
      c.req.param("id"),
    )
    .first();
  if (!result) throw new ApiError(404, "Quote not found.");
  return c.json({ quote: await loadQuote(c.env, c.req.param("id")) });
});
app.post("/api/admin/quotes/:id/retry-emails", async (c) => {
  const quote = await loadQuote(c.env, c.req.param("id"));
  if (!quote) throw new ApiError(404, "Quote not found.");
  await deliverQuoteEmails(c.env, quote.id);
  return c.json({
    emails: await emailRecords(c.env, quote.id),
    quote: await loadQuote(c.env, quote.id),
  });
});
app.delete("/api/admin/quotes/:id", async (c) => {
  const result = await c.env.DB.prepare(
    "DELETE FROM quotes WHERE id=? RETURNING id",
  )
    .bind(c.req.param("id"))
    .first();
  if (!result) throw new ApiError(404, "Quote not found.");
  return c.json({ deleted: true });
});
app.get("/api/admin/contacts", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT c.id,c.name,c.email,c.phone,c.subject,c.message,c.created_at createdAt,e.status emailStatus,e.last_error lastError FROM contacts c LEFT JOIN email_records e ON e.contact_id=c.id ORDER BY c.created_at DESC LIMIT 100",
  ).all();
  return c.json({ contacts: rows.results });
});
app.post("/api/admin/contacts/:id/retry-email", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT id FROM email_records WHERE contact_id=?",
  )
    .bind(c.req.param("id"))
    .first<{ id: string }>();
  if (!row) throw new ApiError(404, "Message not found.");
  await deliverOutbox(c.env, row.id);
  return c.json(
    await c.env.DB.prepare(
      "SELECT status emailStatus,last_error lastError FROM email_records WHERE id=?",
    )
      .bind(row.id)
      .first(),
  );
});
app.delete("/api/admin/contacts/:id", async (c) => {
  const row = await c.env.DB.prepare(
    "DELETE FROM contacts WHERE id=? RETURNING id",
  )
    .bind(c.req.param("id"))
    .first();
  if (!row) throw new ApiError(404, "Message not found.");
  return c.json({ deleted: true });
});
app.get("/robots.txt", (c) => {
  c.header("Content-Type", "text/plain");
  return c.body(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n${c.env.APP_URL ? `Sitemap: ${c.env.APP_URL.replace(/\/$/, "")}/sitemap.xml\n` : ""}`,
  );
});
app.get("/sitemap.xml", (c) => {
  const base = c.env.APP_URL || new URL(c.req.url).origin;
  const escape = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll('"', "&quot;");
  c.header("Content-Type", "application/xml");
  return c.body(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["/", "/services", "/about", "/gallery", "/contact", "/quote", "/privacy", "/terms"].map((path) => `<url><loc>${escape(base.replace(/\/$/, "") + path)}</loc></url>`).join("")}</urlset>`,
  );
});
app.all("/api/*", (c) => c.json({ error: "Endpoint not found." }, 404));
app.all("*", async (c) => {
  if (c.req.path.startsWith("/admin"))
    c.header("X-Robots-Tag", "noindex, nofollow");
  if (c.env.ASSETS) {
    const response = await c.env.ASSETS.fetch(c.req.raw);
    const meta = PAGE_META[c.req.path];
    if (meta && response.headers.get("Content-Type")?.includes("text/html")) {
      const config = getPublicConfig(c.env);
      const escape = (value: string) =>
        value
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;");
      const base = (c.env.APP_URL || new URL(c.req.url).origin).replace(
        /\/$/,
        "",
      );
      const title = escape(`${meta.title} | ${config.business.name}`);
      const canonical = escape(base + c.req.path);
      const structured = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: config.business.name,
        description: config.business.description,
        url: base,
        telephone: config.business.phone,
        email: config.business.email,
        areaServed: ["Tampa", "Brandon", "Hillsborough County", "Tampa Bay"],
        ...(config.business.logoUrl ? { logo: config.business.logoUrl } : {}),
        sameAs: [
          config.business.googleBusinessUrl,
          ...config.business.socialUrls,
        ].filter(Boolean),
      }).replaceAll("<", "\\u003c");
      let html = await response.text();
      html = html
        .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
        .replace(
          /<meta name="description" content="[^"]*"\s*\/>/,
          `<meta name="description" content="${escape(meta.description)}" />`,
        )
        .replace(
          /<meta property="og:title" content="[^"]*"\s*\/>/,
          `<meta property="og:title" content="${title}" />`,
        )
        .replace(
          /<meta property="og:description" content="[^"]*"\s*\/>/,
          `<meta property="og:description" content="${escape(meta.description)}" />`,
        );
      html = html.replace(
        "</head>",
        `<link rel="canonical" href="${canonical}"/><meta property="og:url" content="${canonical}"/><script type="application/ld+json">${structured}</script></head>`,
      );
      const headers = new Headers(response.headers);
      headers.delete("Content-Length");
      headers.delete("ETag");
      headers.set("Content-Type", "text/html; charset=utf-8");
      return new Response(html, { status: response.status, headers });
    }
    const headers = new Headers(response.headers);
    if (c.req.path.startsWith("/admin")) {
      headers.set("X-Robots-Tag", "noindex, nofollow");
      headers.set("Cache-Control", "no-store");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return c.text("Frontend assets are served by Vite during development.", 404);
});
export default app;
