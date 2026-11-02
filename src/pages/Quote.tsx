import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";
import type {
  CleaningArea,
  Property,
  PublicConfig,
  QuoteReceipt,
  Service,
} from "../../shared/types";
import {
  SPECIAL_CONDITIONS,
  SERVICE_LABELS,
  SERVICE_COLORS,
} from "../../shared/types";
import { calculateEstimate } from "../../shared/pricing";
import PropertyMap from "../components/PropertyMap";
import EstimatePanel from "../components/EstimatePanel";
import Turnstile from "../components/Turnstile";
import { api, submissionKey } from "../api";
export default function Quote({ config }: { config: PublicConfig }) {
  const [property, setProperty] = useState<Property | null>(null);
  const [areas, setAreas] = useState<CleaningArea[]>([]);
  const [service, setService] = useState<Service>("driveway");
  const [conditions, setConditions] = useState<string[]>([]);
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const calculation = useMemo(() => {
    if (!property || !areas.length) return { estimate: null, error: "" };
    try {
      return {
        estimate: calculateEstimate(
          areas,
          property,
          config.pricing,
          conditions,
        ),
        error: "",
      };
    } catch (e) {
      return {
        estimate: null,
        error: e instanceof Error ? e.message : "Please check your outlines.",
      };
    }
  }, [areas, property, config.pricing, conditions]);
  const submissionBlocker = !property
    ? config.mapsApiKey
      ? "Select your property address from the map’s search suggestions first."
      : "Property maps are unavailable, so an instant estimate cannot be submitted yet. You can request a custom quote instead."
    : !areas.length
      ? "Draw and finish at least one cleaning-area outline on the map first."
      : calculation.error
        ? `Please correct your outlines: ${calculation.error}`
        : config.production && !config.turnstileSiteKey
          ? "Online submission verification is unavailable. Please contact us to request service."
          : config.production && !token
            ? "Complete the verification above before submitting your quote."
            : "";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property || !calculation.estimate || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const payload = {
      customer: {
        name: String(form.get("name")),
        email: String(form.get("email")),
        phone: String(form.get("phone")),
      },
      property,
      areas,
      conditions,
      notes: String(form.get("notes") || ""),
      preferredDate: String(form.get("preferredDate") || ""),
      timeWindow: String(form.get("timeWindow") || ""),
      accessInstructions: String(form.get("accessInstructions") || ""),
      consent: form.get("consent") === "on",
      website: String(form.get("website") || ""),
    };
    try {
      const idempotencyKey = await submissionKey(
        payload,
        "rosalutions.quoteSubmission",
      );
      const receipt = await api<QuoteReceipt>("/api/quotes", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          idempotencyKey,
          turnstileToken: token,
        }),
      });
      navigate("/quote/received", { state: { receipt } });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We could not save your quote. Please try again.",
      );
      setReset((x) => x + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="section quote-page">
      <div className="container">
        <div className="page-heading">
          <div className="eyebrow">Your property. Your estimate.</div>
          <h1>Get Your Free Instant Quote</h1>
          <p className="page-intro">
            A few points on the map. A clearer picture of the price.
          </p>
        </div>
        <ol className="quote-steps" aria-label="Quote steps">
          <li className="active">
            <span>01</span> Find your property
          </li>
          <li className={property ? "active" : ""}>
            <span>02</span> Outline your areas
          </li>
          <li className={calculation.estimate ? "active" : ""}>
            <span>03</span> Request service
          </li>
        </ol>
        <div className="quote-layout">
          <div className="stack">
            <section className="card map-card">
              <div className="section-title">
                <MapPin size={22} />
                <div>
                  <h2>Find it. Outline it. Refresh it.</h2>
                  <p className="muted">
                    Search your address, then tap around the edges of the area
                    you want cleaned. Complete the outline to calculate its
                    size.
                  </p>
                </div>
              </div>
              <fieldset className="service-picker">
                <legend>Choose a service for your next outline</legend>
                {config.pricing.enabledServices.map((value) => (
                  <label
                    key={value}
                    className={service === value ? "selected" : ""}
                    style={
                      {
                        "--service-color": SERVICE_COLORS[value],
                      } as React.CSSProperties
                    }
                  >
                    <input
                      type="radio"
                      name="active-service"
                      value={value}
                      checked={service === value}
                      onChange={() => setService(value)}
                    />
                    <i />
                    {SERVICE_LABELS[value]}
                  </label>
                ))}
              </fieldset>
              <PropertyMap
                apiKey={config.mapsApiKey}
                property={property}
                onPropertyChange={(p) => {
                  setProperty(p);
                }}
                areas={areas}
                onAreasChange={setAreas}
                activeService={service}
              />
              {calculation.error && (
                <p className="notice error" role="alert">
                  {calculation.error}
                </p>
              )}
              <p className="fine-print">
                Blue for driveways, green for sidewalks, orange for patios. You
                can add more than one area. Overlaps within one service are
                counted once.
              </p>
            </section>
            <section className="card">
              <h2>Anything we should take a closer look at?</h2>
              <p className="muted">
                Special treatments may need a revised quote. Selecting a
                condition requests an owner review; it does not add an automatic
                surcharge.
              </p>
              <div className="condition-grid">
                {SPECIAL_CONDITIONS.map((value) => (
                  <label key={value} className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={conditions.includes(value)}
                      onChange={(e) =>
                        setConditions((c) =>
                          e.target.checked
                            ? [...c, value]
                            : c.filter((v) => v !== value),
                        )
                      }
                    />
                    {value}
                  </label>
                ))}
              </div>
            </section>
            <section className="card">
              <h2>Let’s take the next step</h2>
              <p className="muted">
                Send your estimate and preferred timing. We’ll review the
                details and get in touch to confirm.
              </p>
              {!calculation.estimate && (
                <p className="notice">
                  Choose your address and complete a valid outline to request
                  this estimate. For other services,{" "}
                  <Link to="/contact">request a custom quote</Link>.
                </p>
              )}
              <form onSubmit={submit} className="stack">
                <div className="form-grid">
                  <label className="field">
                    Full name
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label className="field">
                    Email address
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                    />
                  </label>
                  <label className="field">
                    Phone number
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      minLength={7}
                      maxLength={30}
                    />
                  </label>
                  <label className="field">
                    Property address
                    <input
                      value={property?.address || ""}
                      readOnly
                      placeholder="Select your address on the map"
                      required
                    />
                  </label>
                  <label className="field">
                    Preferred date <span className="muted">(optional)</span>
                    <input
                      name="preferredDate"
                      type="date"
                      min={new Date().toLocaleDateString("en-CA", {
                        timeZone: "America/New_York",
                      })}
                    />
                  </label>
                  <label className="field">
                    Preferred time window{" "}
                    <span className="muted">(optional)</span>
                    <select name="timeWindow">
                      <option value="">No preference</option>
                      <option>Morning</option>
                      <option>Afternoon</option>
                      <option>Flexible</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  Notes about the property
                  <textarea name="notes" rows={3} maxLength={3000} />
                </label>
                <label className="field">
                  Access instructions
                  <textarea
                    name="accessInstructions"
                    rows={2}
                    maxLength={1000}
                    placeholder="For example, gate access or where to park"
                  />
                </label>
                <div className="honeypot" aria-hidden="true">
                  <label>
                    Website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                <label className="checkbox-field">
                  <input type="checkbox" name="consent" required />I agree to be
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
                {!config.production && config.emailMode === "preview" && (
                  <p className="notice">
                    Local email preview mode: requests are saved, but no email
                    is sent to your inbox. View the saved email previews in the{" "}
                    <Link to="/admin">owner dashboard</Link>.
                  </p>
                )}
                {submissionBlocker && (
                  <p
                    id="quote-submission-blocker"
                    className="notice"
                    role="status"
                  >
                    {submissionBlocker}{" "}
                    {(!config.mapsApiKey ||
                      (config.production && !config.turnstileSiteKey)) && (
                      <Link to="/contact">Request a custom quote</Link>
                    )}
                  </p>
                )}
                <button
                  className="button"
                  aria-describedby={
                    submissionBlocker ? "quote-submission-blocker" : undefined
                  }
                  disabled={
                    busy ||
                    !calculation.estimate ||
                    (config.production && !token)
                  }
                >
                  {busy
                    ? "Saving your request…"
                    : "Email My Quote & Request Service"}
                  <ArrowRight size={18} />
                </button>
                <p className="fine-print">
                  <ShieldCheck size={14} /> No payment or account required. Your
                  preferred time is a request, not a confirmed booking.
                </p>
              </form>
            </section>
          </div>
          <div className="quote-sidebar">
            <EstimatePanel
              estimate={calculation.estimate}
              property={property}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
