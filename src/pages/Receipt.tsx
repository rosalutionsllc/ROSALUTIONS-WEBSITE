import { useLocation, Link } from "react-router-dom";
import type { PublicConfig, QuoteReceipt } from "../../shared/types";
import { CheckCircle2 } from "lucide-react";
import { money, sqft } from "../api";
export default function Receipt({ config }: { config: PublicConfig }) {
  const location = useLocation();
  const receipt = (location.state as { receipt?: QuoteReceipt } | null)
    ?.receipt;
  return (
    <div className="section">
      <div className="container receipt">
        <CheckCircle2 size={48} />
        <div className="eyebrow">Your next fresh start</div>
        <h1>
          {receipt
            ? "Your request is saved."
            : "Thanks for considering Rosalutions."}
        </h1>
        {receipt ? (
          <>
            <p>
              Quote <strong>{receipt.quoteNumber}</strong>
            </p>
            <div className="receipt-price">
              {money(receipt.estimate.totalCents)}
            </div>
            <p>
              {sqft(receipt.estimate.totalSquareFeet)} sq. ft. · Preliminary
              estimate
            </p>
            <p>
              We’ll review your property and contact you to discuss next steps.
              Your preferred date is not a confirmed appointment.
            </p>
            <div className="card">
              <h2>Email status</h2>
              <p>
                {receipt.emails.customer === "sent"
                  ? "Your estimate email was accepted by our email provider."
                  : "Your estimate email has not been sent. Your request is safely saved."}
              </p>
              <p>
                {receipt.emails.business === "sent"
                  ? "The business notification was accepted by our email provider."
                  : "The business email notification is pending or unavailable."}
              </p>
              {(receipt.emails.customer !== "sent" ||
                receipt.emails.business !== "sent") && (
                <p>
                  Keep your quote number and call{" "}
                  <a href={`tel:${config.business.phone}`}>
                    {config.business.phone}
                  </a>{" "}
                  if you need to follow up.
                </p>
              )}
            </div>
          </>
        ) : (
          <p>
            Quote details are shown immediately after submission. For help with
            an existing request, contact us with your quote number.
          </p>
        )}
        <div className="button-row">
          <Link to="/" className="button">
            Back to home
          </Link>
          <Link to="/contact" className="button button-secondary">
            Contact Rosalutions
          </Link>
        </div>
      </div>
    </div>
  );
}
