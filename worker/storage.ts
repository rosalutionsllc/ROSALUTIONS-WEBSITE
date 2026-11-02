import type { Env } from "./env";
import type {
  CleaningArea,
  EmailRecord,
  EmailStatus,
  QuoteReceipt,
  QuoteRecord,
  QuoteStatus,
} from "../shared/types";
export interface QuoteRow {
  id: string;
  quote_number: string;
  idempotency_key: string;
  request_hash: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  property_json: string;
  estimate_json: string;
  pricing_json: string;
  conditions_json: string;
  notes: string;
  preferred_date: string;
  time_window: string;
  access_instructions: string;
  status: QuoteStatus;
  private_notes: string;
  created_at: string;
  updated_at: string;
}
export interface AreaRow {
  quote_id: string;
  id: string;
  service: CleaningArea["service"];
  geometry_json: string;
}
export interface OutboxRow {
  id: string;
  quote_id: string | null;
  contact_id: string | null;
  kind: "customer" | "business" | "contact";
  recipient: string;
  subject: string;
  html: string;
  text_content: string;
  reply_to: string;
  status: EmailStatus;
  attempts: number;
  provider_id: string | null;
  last_error: string | null;
  first_attempt_at: string | null;
  locked_until: string | null;
  updated_at: string;
}
export async function hydrateQuotes(
  env: Env,
  rows: QuoteRow[],
): Promise<QuoteRecord[]> {
  if (!rows.length) return [];
  const marks = rows.map(() => "?").join(",");
  const ids = rows.map((r) => r.id);
  const [areas, emails] = await Promise.all([
    env.DB.prepare(
      `SELECT quote_id,id,service,geometry_json FROM cleaning_areas WHERE quote_id IN (${marks}) ORDER BY rowid`,
    )
      .bind(...ids)
      .all<AreaRow>(),
    env.DB.prepare(
      `SELECT quote_id,kind,status FROM email_records WHERE quote_id IN (${marks})`,
    )
      .bind(...ids)
      .all<Pick<OutboxRow, "quote_id" | "kind" | "status">>(),
  ]);
  return rows.map((row) => ({
    id: row.id,
    quoteNumber: row.quote_number,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
    },
    property: JSON.parse(row.property_json),
    estimate: JSON.parse(row.estimate_json),
    pricing: JSON.parse(row.pricing_json),
    conditions: JSON.parse(row.conditions_json),
    areas: areas.results
      .filter((a) => a.quote_id === row.id)
      .map((a) => ({
        id: a.id,
        service: a.service,
        geometry: JSON.parse(a.geometry_json),
      })),
    notes: row.notes,
    preferredDate: row.preferred_date,
    timeWindow: row.time_window,
    accessInstructions: row.access_instructions,
    status: row.status,
    privateNotes: row.private_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    emails: {
      customer:
        emails.results.find(
          (e) => e.quote_id === row.id && e.kind === "customer",
        )?.status || "pending",
      business:
        emails.results.find(
          (e) => e.quote_id === row.id && e.kind === "business",
        )?.status || "pending",
    },
  }));
}
export async function loadQuote(
  env: Env,
  id: string,
): Promise<QuoteRecord | null> {
  const row = await env.DB.prepare("SELECT * FROM quotes WHERE id=?")
    .bind(id)
    .first<QuoteRow>();
  return row ? (await hydrateQuotes(env, [row]))[0] : null;
}
export function receipt(quote: QuoteRecord): QuoteReceipt {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    estimate: quote.estimate,
    status: quote.status,
    emails: quote.emails,
  };
}
export async function emailRecords(
  env: Env,
  quoteId: string,
): Promise<EmailRecord[]> {
  const result = await env.DB.prepare(
    "SELECT * FROM email_records WHERE quote_id=? ORDER BY kind",
  )
    .bind(quoteId)
    .all<OutboxRow>();
  return result.results.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    attempts: row.attempts,
    subject: row.subject,
    html: row.html,
    lastError: row.last_error || undefined,
    updatedAt: row.updated_at,
  }));
}
