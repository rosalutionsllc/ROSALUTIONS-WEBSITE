import type { Estimate, Property } from "../../shared/types";
import { DISCLAIMER, SERVICE_LABELS } from "../../shared/types";
import { money, sqft } from "../api";
export default function EstimatePanel({
  estimate,
  property,
}: {
  estimate: Estimate | null;
  property: Property | null;
}) {
  return (
    <aside className="estimate-panel card" aria-label="Your estimated price">
      <div className="eyebrow">Clear pricing. No guesswork.</div>
      <h2>Your estimate</h2>
      <p className="muted">
        {property?.address || "Choose your property to get started."}
      </p>
      {estimate ? (
        <>
          <div className="estimate-total" aria-live="polite">
            {money(estimate.totalCents)}
            <span>preliminary estimate</span>
          </div>
          <div className="estimate-lines">
            {estimate.lines.map((line) => (
              <div key={line.service}>
                <strong>{SERVICE_LABELS[line.service]}</strong>
                <span>
                  {sqft(line.squareFeet)} sq. ft. · {line.areaCount}{" "}
                  {line.areaCount === 1 ? "outline" : "outlines"}
                </span>
                <span>{money(line.rateCents)} / sq. ft.</span>
                <b>{money(line.amountCents)}</b>
              </div>
            ))}
          </div>
          <dl className="price-breakdown">
            <div>
              <dt>Total area</dt>
              <dd>{sqft(estimate.totalSquareFeet)} sq. ft.</dd>
            </div>
            <div>
              <dt>Subtotal</dt>
              <dd>{money(estimate.subtotalCents)}</dd>
            </div>
            {estimate.minimumAdjustmentCents > 0 && (
              <div>
                <dt>Minimum visit adjustment</dt>
                <dd>{money(estimate.minimumAdjustmentCents)}</dd>
              </div>
            )}
            {estimate.taxCents > 0 && (
              <div>
                <dt>Tax</dt>
                <dd>{money(estimate.taxCents)}</dd>
              </div>
            )}
          </dl>
          {estimate.needsReview && (
            <div className="notice">
              <strong>Owner review needed</strong>
              <ul>
                {estimate.reviewReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {estimate.warnings.map((warning) => (
            <p className="notice" key={warning}>
              {warning}
            </p>
          ))}
        </>
      ) : (
        <div className="estimate-empty">
          Draw your first cleaning area to see the price. No contact details
          needed.
        </div>
      )}
      <p className="fine-print">{DISCLAIMER}</p>
      <p className="fine-print">
        Submitting a request does not book an appointment.
      </p>
    </aside>
  );
}
