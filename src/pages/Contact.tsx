import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, ArrowUpRight } from "lucide-react";
import type { PublicConfig } from "../../shared/types";
import { api, submissionKey } from "../api";
import Turnstile from "../components/Turnstile";
export default function Contact({ config }: { config: PublicConfig }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    id: string;
    emailStatus: string;
  } | null>(null);
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const payload = {
      name: String(data.get("name")),
      email: String(data.get("email")),
      phone: String(data.get("phone")),
      subject: String(data.get("subject")),
      message: String(data.get("message")),
      consent: data.get("consent") === "on",
      website: String(data.get("website") || ""),
    };
    setBusy(true);
    setError("");
    try {
      const idempotencyKey = await submissionKey(
        payload,
        "rosalutions.contactSubmission",
      );
      setResult(
        await api("/api/contact", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            idempotencyKey,
            turnstileToken: token,
          }),
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your message could not be saved. Please try again.",
      );
      setReset((r) => r + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="section">
      <div className="container">
        <div className="page-heading">
          <div className="eyebrow">Let’s talk about your property</div>
          <h1>
            A cleaner space starts
            <br />
            with a conversation.
          </h1>
          <p className="page-intro">
            Questions, special surfaces, or a project that needs a closer look?
            Tell us what you have in mind.
          </p>
        </div>
        <div className="contact-layout">
          <aside className="contact-info">
            <h2>Get in touch</h2>
            <a href={`tel:${config.business.phone}`}>
              <Phone />
              {config.business.phone}
            </a>
            <a href={`mailto:${config.business.email}`}>
              <Mail />
              {config.business.email}
            </a>
            <p>
              Serving {config.business.serviceArea}. If you’re nearby, ask us
              about your address.
            </p>
            <div className="card">
              <h3>Looking for driveway, sidewalk or patio cleaning?</h3>
              <p>Outline your areas on the map for a preliminary estimate.</p>
              <Link className="text-link" to="/quote">
                Get an instant quote <ArrowUpRight size={18} />
              </Link>
            </div>
          </aside>
          <section className="card">
            {result ? (
              <div role="status">
                <span className="eyebrow">Message received</span>
                <h2>Thanks for reaching out.</h2>
                <p>
                  Your request has been saved. We’ll review your message and
                  contact you to discuss the details.
                </p>
                {result.emailStatus !== "sent" && (
                  <p className="notice">
                    Your message is saved, but the email notification has not
                    been delivered. For a time-sensitive request, please call{" "}
                    {config.business.phone}.
                  </p>
                )}
                <Link to="/" className="button button-secondary">
                  Back to home
                </Link>
              </div>
            ) : (
              <form className="stack" onSubmit={submit}>
                <h2>Request a custom quote</h2>
                <div className="form-grid">
                  <label className="field">
                    Full name
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                    />
                  </label>
                  <label className="field">
                    Email
                    <input
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </label>
                  <label className="field">
                    Phone
                    <input
                      name="phone"
                      type="tel"
                      required
                      minLength={7}
                      maxLength={30}
                      autoComplete="tel"
                    />
                  </label>
                  <label className="field">
                    Service or subject
                    <select name="subject" required>
                      <option value="">Choose a topic</option>
                      <option>House exterior washing</option>
                      <option>Exterior surface cleaning</option>
                      <option>Fence cleaning and restoration</option>
                      <option>Rust removal</option>
                      <option>Driveway, sidewalk or patio</option>
                      <option>Other question</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  Tell us about your project
                  <textarea
                    name="message"
                    rows={6}
                    required
                    minLength={10}
                    maxLength={5000}
                    placeholder="Include your neighborhood and the surfaces you’d like cleaned."
                  />
                </label>
                <div className="honeypot" aria-hidden="true">
                  <label>
                    Website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                <label className="checkbox-field">
                  <input name="consent" type="checkbox" required />I agree to be
                  contacted about this request and have read the{" "}
                  <Link to="/privacy">privacy policy</Link>.
                </label>
                <Turnstile
                  siteKey={config.turnstileSiteKey}
                  onToken={setToken}
                  reset={reset}
                />
                {error && (
                  <p className="notice error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button"
                  disabled={busy || (config.production && !token)}
                >
                  {busy ? "Sending your request…" : "Send my request"}
                  <ArrowUpRight size={18} />
                </button>
                <p className="fine-print">
                  Submitting this form does not confirm an appointment.
                </p>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
