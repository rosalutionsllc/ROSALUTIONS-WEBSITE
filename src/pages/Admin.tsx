import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, LockKeyhole, ArrowLeft, RefreshCw } from "lucide-react";
import type {
  EmailRecord,
  PublicConfig,
  QuoteRecord,
  QuoteStatus,
} from "../../shared/types";
import { SERVICE_LABELS } from "../../shared/types";
import { api, money, sqft } from "../api";
import PropertyMap from "../components/PropertyMap";
import EstimatePanel from "../components/EstimatePanel";
const statuses: QuoteStatus[] = [
  "new",
  "needs_review",
  "contacted",
  "approved",
  "scheduled",
  "completed",
  "declined",
  "cancelled",
];
const label = (value: string) => value.replaceAll("_", " ");
function AdminAccess({
  config,
  onAuth,
}: {
  config: PublicConfig;
  onAuth: () => void;
}) {
  const [token, setToken] = useState("");
  return (
    <div className="card admin-access">
      <LockKeyhole />
      <h2>Owner access</h2>
      {config.production ? (
        <p>
          Sign in through the Cloudflare Access page for this site using the
          authorized owner email. If access is unavailable, check the protected
          application configuration.
        </p>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            sessionStorage.setItem("rosalutions.localAdminToken", token);
            onAuth();
          }}
        >
          <p>
            Enter the local administrator token configured in your local
            environment.
          </p>
          <label className="field">
            Local administrator token
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <button className="button">Unlock local dashboard</button>
        </form>
      )}
    </div>
  );
}
interface ContactRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
  emailStatus: string;
  lastError?: string;
}
export default function Admin({ config }: { config: PublicConfig }) {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    new: number;
    needsReview: number;
    estimatedValueCents: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision((r) => r + 1);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({
      search,
      status,
      service,
      sort,
      from,
      to,
      offset: String(offset),
    });
    Promise.all([
      api<{ quotes: QuoteRecord[]; nextOffset?: number | null }>(
        `/api/admin/quotes?${query}`,
      ),
      api<typeof summary>("/api/admin/summary"),
      api<{ contacts: ContactRecord[] }>("/api/admin/contacts"),
    ])
      .then(([data, s, c]) => {
        if (active) {
          setQuotes(data.quotes);
          setNextOffset(data.nextOffset ?? null);
          setSummary(s);
          setContacts(c.contacts);
          setAuthorized(true);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          if (e.status === 401 || e.status === 403) setAuthorized(false);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, status, service, sort, from, to, offset, revision]);
  async function exportCsv() {
    try {
      const token = sessionStorage.getItem("rosalutions.localAdminToken");
      const response = await fetch("/api/admin/export.csv", {
        headers: token ? { "X-Local-Admin-Token": token } : {},
      });
      if (!response.ok) throw new Error("Export could not be generated.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "rosalutions-quotes.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function contactAction(id: string, action: "retry-email" | "delete") {
    if (
      action === "delete" &&
      !window.confirm(
        "Permanently delete this contact request and its email records?",
      )
    )
      return;
    try {
      await api(
        `/api/admin/contacts/${id}${action === "retry-email" ? "/retry-email" : ""}`,
        { method: action === "delete" ? "DELETE" : "POST" },
      );
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="section">
      <div className="container admin-page">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">Owner workspace</span>
            <h1>Requests & relationships</h1>
          </div>
          {authorized && (
            <div className="button-row">
              <button className="button button-secondary" onClick={exportCsv}>
                <Download size={17} />
                Export CSV
              </button>
              {!config.production && (
                <button
                  className="button button-quiet"
                  onClick={() => {
                    sessionStorage.removeItem("rosalutions.localAdminToken");
                    setAuthorized(false);
                    reload();
                  }}
                >
                  Lock dashboard
                </button>
              )}
            </div>
          )}
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {loading && !authorized && <p role="status">Loading your workspace…</p>}
        {!authorized && !loading ? (
          <AdminAccess config={config} onAuth={reload} />
        ) : (
          authorized && (
            <>
              <div className="admin-stats">
                {[
                  ["Total requests", summary?.total ?? 0],
                  ["New requests", summary?.new ?? 0],
                  ["Need review", summary?.needsReview ?? 0],
                  ["Estimated value", money(summary?.estimatedValueCents ?? 0)],
                ].map(([title, value]) => (
                  <div className="card" key={title}>
                    <span>{title}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <section className="card stack">
                <h2>Quote requests</h2>
                <div className="admin-filters">
                  <label className="field">
                    Search customer or address
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setOffset(0);
                      }}
                    />
                  </label>
                  <label className="field">
                    Status
                    <select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setOffset(0);
                      }}
                    >
                      <option value="">All statuses</option>
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {label(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Service
                    <select
                      value={service}
                      onChange={(e) => {
                        setService(e.target.value);
                        setOffset(0);
                      }}
                    >
                      <option value="">All services</option>
                      {Object.entries(SERVICE_LABELS).map(([value, name]) => (
                        <option key={value} value={value}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Sort
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="date_desc">Newest first</option>
                      <option value="date_asc">Oldest first</option>
                      <option value="customer_asc">Customer A–Z</option>
                      <option value="estimate_desc">Highest estimate</option>
                      <option value="estimate_asc">Lowest estimate</option>
                    </select>
                  </label>
                  <label className="field">
                    From
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        setOffset(0);
                      }}
                    />
                  </label>
                  <label className="field">
                    To
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => {
                        setTo(e.target.value);
                        setOffset(0);
                      }}
                    />
                  </label>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Quote / date</th>
                        <th>Customer</th>
                        <th>Service</th>
                        <th>Estimate</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q) => (
                        <tr key={q.id}>
                          <td>
                            <Link to={`/admin/quotes/${q.id}`}>
                              {q.quoteNumber}
                            </Link>
                            <small>
                              {new Date(q.createdAt).toLocaleDateString()}
                            </small>
                          </td>
                          <td>
                            {q.customer.name}
                            <small>{q.property.address}</small>
                          </td>
                          <td>
                            {q.estimate.lines
                              .map((l) => SERVICE_LABELS[l.service])
                              .join(", ")}
                            <small>
                              {sqft(q.estimate.totalSquareFeet)} sq. ft.
                            </small>
                          </td>
                          <td>{money(q.estimate.totalCents)}</td>
                          <td>
                            <span className="badge">{label(q.status)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!quotes.length && (
                    <p className="empty-state">
                      No quote requests match these filters.
                    </p>
                  )}
                </div>
                <div className="button-row">
                  {offset > 0 && (
                    <button
                      className="button button-secondary"
                      onClick={() => setOffset(Math.max(0, offset - 100))}
                    >
                      Previous page
                    </button>
                  )}
                  {nextOffset !== null && (
                    <button
                      className="button button-secondary"
                      onClick={() => setOffset(nextOffset)}
                    >
                      Next page
                    </button>
                  )}
                </div>
              </section>
              <section className="card stack">
                <h2>Contact messages</h2>
                {contacts.length ? (
                  contacts.map((c) => (
                    <article className="contact-message" key={c.id}>
                      <div className="section-title">
                        <h3>{c.subject}</h3>
                        <span className="badge">Email: {c.emailStatus}</span>
                      </div>
                      <p>
                        <strong>{c.name}</strong> ·{" "}
                        <a href={`mailto:${c.email}`}>{c.email}</a> ·{" "}
                        <a href={`tel:${c.phone}`}>{c.phone}</a>
                      </p>
                      <p className="preserve-lines">{c.message}</p>
                      <small>{new Date(c.createdAt).toLocaleString()}</small>
                      <div className="button-row">
                        {c.emailStatus !== "sent" && (
                          <button
                            className="button button-secondary"
                            onClick={() => contactAction(c.id, "retry-email")}
                          >
                            Retry notification
                          </button>
                        )}
                        <button
                          className="button button-quiet"
                          onClick={() => contactAction(c.id, "delete")}
                        >
                          Delete request
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="muted">No contact messages yet.</p>
                )}
              </section>
            </>
          )
        )}
      </div>
    </div>
  );
}
export function AdminQuote({ config }: { config: PublicConfig }) {
  const { id } = useParams();
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<QuoteStatus>("new");
  const [notes, setNotes] = useState("");
  const load = useCallback(async () => {
    try {
      const d = await api<{ quote: QuoteRecord; emails: EmailRecord[] }>(
        `/api/admin/quotes/${id}`,
      );
      setQuote(d.quote);
      setEmails(d.emails);
      setStatus(d.quote.status);
      setNotes(d.quote.privateNotes);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSuccess("");
    try {
      await api(`/api/admin/quotes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, privateNotes: notes }),
      });
      await load();
      setSuccess("Changes saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    setBusy(true);
    try {
      await api(`/api/admin/quotes/${id}/retry-emails`, { method: "POST" });
      await load();
      setSuccess("Notification statuses updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !window.confirm(
        "Permanently delete this quote, its customer details, outlines and email records?",
      )
    )
      return;
    try {
      await api(`/api/admin/quotes/${id}`, { method: "DELETE" });
      window.location.assign("/admin");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="section">
      <div className="container">
        <Link to="/admin" className="text-link">
          <ArrowLeft size={16} /> All requests
        </Link>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {!quote ? (
          <AdminAccess config={config} onAuth={() => void load()} />
        ) : (
          <>
            <div className="page-heading">
              <div className="eyebrow">{quote.quoteNumber}</div>
              <h1>{quote.customer.name}</h1>
              <p>{quote.property.address}</p>
            </div>
            <div className="quote-layout">
              <div className="stack">
                <section className="card">
                  <h2>Request details</h2>
                  <p>
                    <a href={`mailto:${quote.customer.email}`}>
                      {quote.customer.email}
                    </a>{" "}
                    ·{" "}
                    <a href={`tel:${quote.customer.phone}`}>
                      {quote.customer.phone}
                    </a>
                  </p>
                  <p>Received {new Date(quote.createdAt).toLocaleString()}</p>
                  <dl className="detail-list">
                    <dt>Preferred appointment</dt>
                    <dd>
                      {quote.preferredDate || "No date preference"} ·{" "}
                      {quote.timeWindow || "No time preference"}
                    </dd>
                    <dt>Special conditions</dt>
                    <dd>{quote.conditions.join(", ") || "None reported"}</dd>
                    <dt>Customer notes</dt>
                    <dd className="preserve-lines">{quote.notes || "None"}</dd>
                    <dt>Access instructions</dt>
                    <dd className="preserve-lines">
                      {quote.accessInstructions || "None"}
                    </dd>
                    <dt>Pricing version</dt>
                    <dd>{quote.pricing.version}</dd>
                  </dl>
                </section>
                <section className="card">
                  <h2>Saved property outlines</h2>
                  <PropertyMap
                    apiKey={config.mapsApiKey}
                    property={quote.property}
                    areas={quote.areas}
                    readOnly
                  />
                  <details>
                    <summary>View saved GeoJSON</summary>
                    <pre className="geojson">
                      {JSON.stringify(
                        {
                          type: "FeatureCollection",
                          features: quote.areas.map((a) => ({
                            type: "Feature",
                            id: a.id,
                            geometry: a.geometry,
                            properties: { service: a.service },
                          })),
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </section>
                <form className="card stack" onSubmit={save}>
                  <h2>Manage this request</h2>
                  <label className="field">
                    Status
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as QuoteStatus)}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {label(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Private owner notes
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={5}
                      maxLength={10000}
                    />
                  </label>
                  <p className="fine-print">
                    Private notes stay in this dashboard and are never added to
                    customer emails.
                  </p>
                  {success && (
                    <p className="notice success" role="status">
                      {success}
                    </p>
                  )}
                  <button className="button" disabled={busy}>
                    Save changes
                  </button>
                </form>
                <section className="card stack">
                  <div className="section-title">
                    <h2>Email notifications</h2>
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={retry}
                    >
                      <RefreshCw size={16} />
                      Retry unsent
                    </button>
                  </div>
                  {emails.map((e) => (
                    <article className="email-record" key={e.id}>
                      <h3>
                        {e.kind === "customer"
                          ? "Customer estimate"
                          : "Business notification"}{" "}
                        <span className="badge">{e.status}</span>
                      </h3>
                      <p>{e.subject}</p>
                      <p className="fine-print">
                        {e.attempts} attempts ·{" "}
                        {new Date(e.updatedAt).toLocaleString()}
                      </p>
                      {e.lastError && <p className="notice">{e.lastError}</p>}
                      {e.html && (
                        <details>
                          <summary>View safe email preview</summary>
                          <iframe
                            title={`${e.kind} email preview`}
                            srcDoc={e.html}
                            sandbox=""
                            className="email-preview"
                          />
                        </details>
                      )}
                    </article>
                  ))}
                </section>
                <section className="card">
                  <h2>Data retention</h2>
                  <p>
                    Remove this request when it is no longer needed under your
                    retention policy. Deletion cannot be undone.
                  </p>
                  <button
                    className="button button-quiet danger"
                    onClick={remove}
                  >
                    Delete this quote permanently
                  </button>
                </section>
              </div>
              <div className="quote-sidebar">
                <EstimatePanel
                  estimate={quote.estimate}
                  property={quote.property}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
