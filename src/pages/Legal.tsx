import { Link } from "react-router-dom";
import type { PublicConfig } from "../../shared/types";
function LegalHeader({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="page-heading container">
        <p className="eyebrow">CLEAR EXPECTATIONS</p>
        <h1>{title}</h1>
        <p className="notice">
          Policy template — the business owner must review and complete
          business-specific details before publication. This template is not
          legal advice.
        </p>
      </div>
      <section className="container legal-content prose">{children}</section>
    </>
  );
}
export function PrivacyPage({ config }: { config: PublicConfig }) {
  return (
    <LegalHeader title="Privacy policy">
      <p>
        This template describes how {config.business.name} intends to handle
        information provided through this website. Effective date: to be
        confirmed by the business before publication.
      </p>
      <h2>Information you provide</h2>
      <p>
        When you request an estimate or contact us, we collect the information
        you submit, which may include your name, email address, phone number,
        property address, geographic coordinates, drawn property outlines,
        appointment preferences, notes, and access instructions. Please do not
        include sensitive personal information that is unnecessary for your
        cleaning request.
      </p>
      <h2>How we use your information</h2>
      <p>
        We use your information to calculate preliminary estimates, review
        cleaning requests, contact you about your project, arrange service when
        agreed, and maintain business records. Providing a phone number or email
        address permits communication about your request; it does not subscribe
        you to unrelated marketing.
      </p>
      <h2>Services that support this website</h2>
      <p>
        This website uses Cloudflare for hosting, database storage, access
        protection, and abuse prevention; Google Maps and Places for property
        search and imagery; and a transactional email provider for quote
        notifications. These providers may process information to deliver their
        services under their own terms and privacy policies. Google’s map tools
        may receive search queries, device information, and map interactions.
      </p>
      <h2>Cookies and similar technology</h2>
      <p>
        Essential security or authentication functions and integrated maps may
        use cookies or similar technologies. The site does not intentionally add
        advertising trackers. The owner must verify the final integrations and
        any applicable consent requirements before publication.
      </p>
      <h2>Storage, retention, and deletion</h2>
      <p>
        Access to customer records is restricted to authorized administration.
        Records are retained only as needed for the request, business
        operations, and applicable recordkeeping obligations. The owner must
        define the final retention period before publication. To request access,
        correction, or deletion of your information, contact{" "}
        <a href={`mailto:${config.business.email}`}>{config.business.email}</a>.
        Some records may need to be retained where required by law.
      </p>
      <h2>Your choices</h2>
      <p>
        You may explore the estimate tool without submitting contact details.
        You can choose to contact the business directly instead of using the
        map. If you no longer wish to receive follow-up about your request, tell
        us using the contact details below.
      </p>
      <h2>Security and changes</h2>
      <p>
        We use appropriate technical safeguards, but no online service can
        guarantee absolute security. This policy may be updated as the website
        or business practices change. The published policy should identify its
        effective date.
      </p>
      <h2>Contact</h2>
      <p>
        {config.business.name}
        <br />
        <a href={`mailto:${config.business.email}`}>{config.business.email}</a>
        <br />
        <a href={`tel:${config.business.phone.replace(/[^+\d]/g, "")}`}>
          {config.business.phone}
        </a>
      </p>
      <p>
        <Link to="/terms">Read the terms of use</Link>
      </p>
    </LegalHeader>
  );
}
export function TermsPage({ config }: { config: PublicConfig }) {
  return (
    <LegalHeader title="Terms of use">
      <p>
        These terms are a template for the website operated by{" "}
        {config.business.name}. Effective date: to be confirmed by the business
        before publication.
      </p>
      <h2>Preliminary estimates</h2>
      <p>
        Prices shown by the online calculator are estimates based on selected
        map areas and the current service rates. Satellite imagery, drawing
        accuracy, surface conditions, access, staining, and treatment
        requirements can affect the final scope and price. All estimates require
        confirmation by {config.business.name}.
      </p>
      <h2>No automatic booking</h2>
      <p>
        Submitting a request or choosing a preferred date does not create an
        appointment, guarantee availability, or establish a binding price
        agreement. We will contact you to review the request and confirm any
        service arrangement separately.
      </p>
      <h2>Measurements and site conditions</h2>
      <p>
        Please outline only surfaces that you are authorized to request cleaning
        for, provide accurate contact details, and disclose relevant access
        restrictions and unusual conditions. The business may revise or decline
        a request after review.
      </p>
      <h2>Pricing and special treatments</h2>
      <p>
        A minimum visit charge applies to the combined automatically priced
        services. Rust, oil, paint, heavy buildup, unusual conditions, and large
        areas may need manual review. Applicable taxes and any agreed additional
        charges will be clarified before service. The calculator does not
        establish tax treatment.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not submit false requests, interfere with the service, attempt
        unauthorized access, or use the website to send spam. Map imagery and
        third-party services remain subject to their providers’ terms and
        availability.
      </p>
      <h2>Service terms to be confirmed</h2>
      <p>
        The business owner must supply any applicable cancellation policy,
        payment terms, service limitations, damage-reporting process, governing
        law, and dispute-resolution terms before publication. This template does
        not invent those business policies or waive rights that cannot lawfully
        be waived.
      </p>
      <h2>Questions</h2>
      <p>
        Contact{" "}
        <a href={`mailto:${config.business.email}`}>{config.business.email}</a>{" "}
        or{" "}
        <a href={`tel:${config.business.phone.replace(/[^+\d]/g, "")}`}>
          {config.business.phone}
        </a>{" "}
        before submitting a request if you have questions.
      </p>
      <p>
        See our <Link to="/privacy">privacy policy</Link> for information about
        customer data.
      </p>
    </LegalHeader>
  );
}
