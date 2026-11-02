import type { Env } from "./env";
import type { OutboxRow } from "./storage";
import { sendEmail } from "./email";
export async function deliverOutbox(env: Env, id: string): Promise<void> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + 60000).toISOString();
  const localPreview = env.APP_ENV === "local" && env.EMAIL_MODE !== "live";
  const row = await env.DB.prepare(
    `UPDATE email_records SET locked_until=? WHERE id=? AND status IN ('pending','failed','preview') AND (locked_until IS NULL OR locked_until < ?) RETURNING *`,
  )
    .bind(lockUntil, id, now.toISOString())
    .first<OutboxRow>();
  if (!row) return;
  if (
    !localPreview &&
    row.first_attempt_at &&
    now.getTime() - Date.parse(row.first_attempt_at) > 23 * 60 * 60 * 1000
  ) {
    await env.DB.prepare(
      "UPDATE email_records SET status='failed', last_error=?, locked_until=NULL, updated_at=? WHERE id=?",
    )
      .bind(
        "The safe retry window expired. Check delivery in Resend before manually sending; this prevents duplicate mail.",
        now.toISOString(),
        id,
      )
      .run();
    return;
  }
  try {
    // Persist the attempt before making an external request. The stable message ID is
    // also the provider idempotency key, including after a worker interruption.
    await env.DB.prepare(
      "UPDATE email_records SET attempts=attempts+1, first_attempt_at=CASE WHEN ? THEN first_attempt_at ELSE COALESCE(first_attempt_at,?) END WHERE id=?",
    )
      .bind(localPreview ? 1 : 0, now.toISOString(), id)
      .run();
    const result = await sendEmail(env, {
      to: row.recipient,
      subject: row.subject,
      html: row.html,
      text: row.text_content,
      replyTo: row.reply_to,
      idempotencyKey: `rosalutions-${id}`,
    });
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE email_records SET status=?,provider_id=?,last_error=?,locked_until=NULL,updated_at=? WHERE id=?",
      ).bind(
        result.status,
        result.providerId || null,
        result.error || null,
        new Date().toISOString(),
        id,
      ),
      env.DB.prepare(
        "INSERT INTO email_attempts(id,email_id,attempted_at,status,safe_error) VALUES(?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        id,
        now.toISOString(),
        result.status,
        result.error || null,
      ),
    ]);
  } catch {
    // Never erase an already-persisted request if email or provider-status storage fails.
    try {
      await env.DB.prepare(
        "UPDATE email_records SET status='failed',last_error='Delivery could not be confirmed. Retry from the dashboard.',locked_until=NULL,updated_at=? WHERE id=?",
      )
        .bind(new Date().toISOString(), id)
        .run();
    } catch {
      /* Pending row remains available to recover after lock expiry. */
    }
  }
}
export async function deliverQuoteEmails(
  env: Env,
  quoteId: string,
): Promise<void> {
  const rows = await env.DB.prepare(
    "SELECT id FROM email_records WHERE quote_id=?",
  )
    .bind(quoteId)
    .all<{ id: string }>();
  await Promise.all(rows.results.map((row) => deliverOutbox(env, row.id)));
}
