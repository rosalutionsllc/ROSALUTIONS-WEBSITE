import {
  DISCLAIMER,
  SERVICE_LABELS,
  type PublicConfig,
  type QuoteRecord,
} from "../shared/types";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  replyTo: string;
}

export interface EmailEnvironment {
  APP_ENV?: string;
  EMAIL_MODE?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export interface EmailDeliveryInput extends RenderedEmail {
  to: string;
  idempotencyKey: string;
}

export interface EmailDeliveryResult {
  status: "sent" | "preview" | "failed";
  providerId?: string;
  error?: string;
}

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
const footage = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const multiline = (value: unknown) =>
  escapeHtml(value).replace(/\r?\n/g, "<br>");
const cleanSubject = (value: string) =>
  value.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").slice(0, 250);

function safeApplicationUrl(appUrl: string, path: string): string {
  const url = new URL(appUrl);
  const local =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local))
  ) {
    throw new Error(
      "Application URL must use HTTPS, or HTTP on localhost during development.",
    );
  }
  return new URL(path, url.origin).toString();
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/New_York",
    }).format(date) + " Eastern"
  );
}

function frame(title: string, body: string, config: PublicConfig): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:24px 12px;background:#f2f6fb;color:#172337;font-family:Arial,Helvetica,sans-serif;line-height:1.6"><table role="presentation" style="width:100%;max-width:640px;margin:0 auto;border-collapse:collapse;background:#ffffff;border:1px solid #dce6f1"><tr><td style="padding:30px 28px;background:#102b46;color:#ffffff"><p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase">${escapeHtml(config.business.serviceArea)}</p><p style="margin:5px 0 0;font-size:24px;font-weight:bold">${escapeHtml(config.business.name)}</p></td></tr><tr><td style="padding:28px"><h1 style="margin:0 0 20px;font-size:25px;line-height:1.25;color:#102b46">${escapeHtml(title)}</h1>${body}</td></tr><tr><td style="padding:22px 28px;background:#edf4fb;font-size:14px"><strong>${escapeHtml(config.business.name)}</strong><br>${escapeHtml(config.business.phone)}<br><a href="mailto:${escapeHtml(config.business.email)}" style="color:#1557a0">${escapeHtml(config.business.email)}</a><br><span style="color:#526478">Questions? Reply to this email or contact us directly.</span></td></tr></table></body></html>`;
}

function detail(label: string, value: string): string {
  return `<p style="margin:0 0 12px"><strong>${escapeHtml(label)}</strong><br>${multiline(value || "Not provided")}</p>`;
}

function estimateTable(quote: QuoteRecord): string {
  const rows = quote.estimate.lines
    .map(
      (line) =>
        `<tr><td style="padding:10px 6px;border-bottom:1px solid #dce6f1">${escapeHtml(SERVICE_LABELS[line.service])}<br><span style="font-size:12px;color:#526478">${line.areaCount} outlined area${line.areaCount === 1 ? "" : "s"}</span></td><td style="padding:10px 6px;border-bottom:1px solid #dce6f1;text-align:right">${footage(line.squareFeet)} sq. ft.<br><span style="font-size:12px;color:#526478">${money(line.rateCents)} / sq. ft.</span></td><td style="padding:10px 6px;border-bottom:1px solid #dce6f1;text-align:right">${money(line.amountCents)}</td></tr>`,
    )
    .join("");
  const extra = (label: string, amount: number) =>
    `<tr><td colspan="2" style="padding:8px 6px">${label}</td><td style="padding:8px 6px;text-align:right">${money(amount)}</td></tr>`;
  return `<table aria-label="Estimate breakdown" style="width:100%;border-collapse:collapse;font-size:14px;margin:20px 0"><thead><tr style="background:#edf4fb;text-align:left"><th style="padding:10px 6px">Service</th><th style="padding:10px 6px;text-align:right">Measurement</th><th style="padding:10px 6px;text-align:right">Amount</th></tr></thead><tbody>${rows}${extra("Subtotal", quote.estimate.subtotalCents)}${quote.estimate.minimumAdjustmentCents ? extra("Minimum visit adjustment", quote.estimate.minimumAdjustmentCents) : ""}${quote.estimate.taxCents ? extra("Tax", quote.estimate.taxCents) : ""}<tr style="background:#102b46;color:#fff;font-weight:bold"><td colspan="2" style="padding:16px 10px">Preliminary estimate</td><td style="padding:16px 10px;text-align:right;font-size:22px">${money(quote.estimate.totalCents)}</td></tr></tbody></table><p style="font-size:13px;color:#526478">Total measured area: ${footage(quote.estimate.totalSquareFeet)} sq. ft. · Pricing version: ${escapeHtml(quote.estimate.pricingVersion)}</p>`;
}

function textBreakdown(quote: QuoteRecord): string {
  return [
    ...quote.estimate.lines.map(
      (line) =>
        `${SERVICE_LABELS[line.service]}: ${footage(line.squareFeet)} sq. ft. × ${money(line.rateCents)} = ${money(line.amountCents)} (${line.areaCount} outlined areas)`,
    ),
    `Total measured area: ${footage(quote.estimate.totalSquareFeet)} sq. ft.`,
    `Subtotal: ${money(quote.estimate.subtotalCents)}`,
    ...(quote.estimate.minimumAdjustmentCents
      ? [
          `Minimum visit adjustment: ${money(quote.estimate.minimumAdjustmentCents)}`,
        ]
      : []),
    ...(quote.estimate.taxCents
      ? [`Tax: ${money(quote.estimate.taxCents)}`]
      : []),
    `Preliminary estimate: ${money(quote.estimate.totalCents)}`,
    `Pricing version: ${quote.estimate.pricingVersion}`,
  ].join("\n");
}

export function renderQuoteEmail(
  quote: QuoteRecord,
  kind: "customer" | "business",
  config: PublicConfig,
  appUrl: string,
): RenderedEmail {
  const business = kind === "business";
  const subject = cleanSubject(
    business
      ? `New Rosalutions Quote Request — ${quote.quoteNumber}`
      : "Your Rosalutions Pressure Washing Estimate",
  );
  const title = business ? "A new quote request" : "Your request is received";
  const appointment =
    [quote.preferredDate, quote.timeWindow].filter(Boolean).join(" · ") ||
    "No date or time preference provided";
  const review = quote.estimate.needsReview
    ? `Manual review required: ${quote.estimate.reviewReasons.join("; ") || "Please review this request before confirming pricing."}`
    : "Rosalutions will review this request and confirm final pricing with you.";
  const adminUrl = business
    ? safeApplicationUrl(
        appUrl,
        `/admin/quotes/${encodeURIComponent(quote.id)}`,
      )
    : "";
  const commonDetails =
    detail("Quote number", quote.quoteNumber) +
    detail("Property", quote.property.address);
  const customerDetails = business
    ? detail(
        "Customer",
        `${quote.customer.name}\n${quote.customer.email}\n${quote.customer.phone}`,
      ) + detail("Received", dateLabel(quote.createdAt))
    : `<p>Thank you, ${escapeHtml(quote.customer.name)}. We received your cleaning request and look forward to helping your property look its best.</p>`;
  const preferences =
    detail("Preferred appointment", appointment) +
    '<p style="font-size:13px;color:#526478">This is a preference only. No appointment has been booked.</p>';
  const extraBusiness = business
    ? detail(
        "Special conditions",
        quote.conditions.join(", ") || "None reported",
      ) +
      detail("Customer notes", quote.notes) +
      detail("Access instructions", quote.accessInstructions) +
      `<p style="margin-top:25px"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:12px 18px;border-radius:6px;color:#fff;background:#1c65b3;text-decoration:none;font-weight:bold">View private quote and property outlines</a></p><p style="font-size:12px;color:#526478">Owner sign-in is required to view this request.</p>`
    : "";
  const warningHtml = `<div style="padding:15px;background:${quote.estimate.needsReview ? "#fff5dd" : "#edf4fb"};border-left:3px solid #2670bc;margin:18px 0">${escapeHtml(review)}</div>`;
  const body =
    customerDetails +
    commonDetails +
    estimateTable(quote) +
    warningHtml +
    (quote.estimate.warnings.length
      ? detail("Measurement notes", quote.estimate.warnings.join("\n"))
      : "") +
    preferences +
    extraBusiness +
    `<p style="font-size:13px;color:#526478;line-height:1.65">${escapeHtml(DISCLAIMER)}</p><p style="font-size:13px;color:#526478">An estimate is not a confirmed appointment or a binding price commitment.</p>`;
  const text = [
    config.business.name,
    title,
    business
      ? `Customer: ${quote.customer.name}\nEmail: ${quote.customer.email}\nPhone: ${quote.customer.phone}\nReceived: ${dateLabel(quote.createdAt)}`
      : `Thank you, ${quote.customer.name}. Your cleaning request has been received.`,
    `Quote number: ${quote.quoteNumber}`,
    `Property: ${quote.property.address}`,
    textBreakdown(quote),
    review,
    ...quote.estimate.warnings,
    `Preferred appointment: ${appointment}`,
    "This is a preference only. No appointment has been booked.",
    ...(business
      ? [
          `Special conditions: ${quote.conditions.join(", ") || "None reported"}`,
          `Customer notes: ${quote.notes || "Not provided"}`,
          `Access instructions: ${quote.accessInstructions || "Not provided"}`,
          `View private quote and property outlines (owner sign-in required): ${adminUrl}`,
        ]
      : []),
    DISCLAIMER,
    "An estimate is not a confirmed appointment or a binding price commitment.",
    `Questions? ${config.business.phone} · ${config.business.email}`,
  ].join("\n\n");
  return {
    subject,
    html: frame(title, body, config),
    text,
    replyTo: business ? quote.customer.email : config.business.email,
  };
}

export function renderContactEmail(
  input: {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
  },
  config: PublicConfig,
  appUrl: string,
): RenderedEmail {
  const subject = cleanSubject(`New Rosalutions Message — ${input.subject}`);
  const adminUrl = safeApplicationUrl(appUrl, "/admin");
  const body =
    detail("From", `${input.name}\n${input.email}\n${input.phone}`) +
    detail("Subject or service", input.subject) +
    detail("Message", input.message) +
    `<p><a href="${escapeHtml(adminUrl)}" style="color:#1557a0">Open the private owner dashboard</a></p>`;
  return {
    subject,
    html: frame("A new customer message", body, config),
    text: `${config.business.name}\n\nFrom: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone}\n\nSubject: ${input.subject}\n\n${input.message}\n\nPrivate owner dashboard: ${adminUrl}`,
    replyTo: input.email,
  };
}

function isEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value) &&
    !/[\r\n]/.test(value)
  );
}

/** Preview never calls the provider. Reuse an outbox record's stable key on retries. */
export async function sendEmail(
  env: EmailEnvironment,
  input: EmailDeliveryInput,
  fetcher: typeof fetch = fetch,
): Promise<EmailDeliveryResult> {
  if (env.APP_ENV === "local" && env.EMAIL_MODE !== "live")
    return { status: "preview" };
  if (env.EMAIL_MODE !== "live" || !env.RESEND_API_KEY || !env.EMAIL_FROM)
    return {
      status: "failed",
      error:
        "Live email is not configured. Configure a verified sender and email API key.",
    };
  const sender = env.EMAIL_FROM.match(/<([^<>]+)>$/)?.[1] ?? env.EMAIL_FROM;
  const senderDomain = sender.split("@")[1]?.toLowerCase();
  if (
    !isEmail(sender) ||
    /[\r\n]/.test(env.EMAIL_FROM) ||
    [
      "gmail.com",
      "googlemail.com",
      "yahoo.com",
      "outlook.com",
      "hotmail.com",
    ].includes(senderDomain ?? "")
  ) {
    return {
      status: "failed",
      error:
        "A verified sender domain is required; a personal mailbox cannot be used as the sender.",
    };
  }
  if (
    !isEmail(input.to) ||
    !isEmail(input.replyTo) ||
    !input.subject ||
    /[\r\n]/.test(input.subject) ||
    !/^[A-Za-z0-9_:.\/-]{8,256}$/.test(input.idempotencyKey)
  ) {
    return { status: "failed", error: "The email envelope is invalid." };
  }
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [input.to],
        reply_to: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return {
        status: "failed",
        error:
          response.status === 429
            ? "The email provider rate limit was reached. Retry later."
            : response.status >= 500
              ? "The email provider is temporarily unavailable. Retry with the same delivery record."
              : "The email provider rejected the message. Check the verified sender and account configuration.",
      };
    }
    const result: unknown = await response.json();
    const providerId =
      result &&
      typeof result === "object" &&
      "id" in result &&
      typeof result.id === "string"
        ? result.id.slice(0, 200)
        : undefined;
    if (!providerId)
      return {
        status: "failed",
        error:
          "The email provider response was incomplete. Retry with the same delivery record.",
      };
    return { status: "sent", providerId };
  } catch {
    return {
      status: "failed",
      error:
        "Email delivery could not be confirmed. Retry with the same delivery record.",
    };
  }
}
