import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  House,
  Footprints,
  Sun,
  PanelsTopLeft,
  Fence,
  Droplets,
  Sparkles,
} from "lucide-react";
import type { PublicConfig, Service } from "../../shared/types";

const instant = [
  {
    id: "driveway" as Service,
    title: "Driveway cleaning",
    icon: House,
    description:
      "Bring a brighter, more welcoming look to the approach to your home. Outline concrete and other suitable driveway surfaces in our map tool.",
    note: "Oil, rust, and other stubborn stains need a closer look and may require a revised estimate.",
  },
  {
    id: "sidewalk" as Service,
    title: "Sidewalk cleaning",
    icon: Footprints,
    description:
      "Refresh the paths that connect your home, driveway, and outdoor spaces. Draw separate outlines for winding walks or individual sections.",
    note: "Add your sidewalks to a driveway or patio request. The minimum applies once to the whole visit.",
  },
  {
    id: "patio" as Service,
    title: "Patio cleaning",
    icon: Sun,
    description:
      "Get your outdoor gathering space ready for more everyday moments. Trace your patio to see an estimate based on its measured surface area.",
    note: "Let us know about delicate surfaces, furniture, access, or unusual buildup so we can plan appropriately.",
  },
];
const custom = [
  {
    title: "House exterior washing",
    icon: House,
    description:
      "A considered approach to exterior walls and siding. We’ll discuss your home’s surfaces, access, and cleaning needs before providing a price.",
  },
  {
    title: "Exterior surface cleaning",
    icon: PanelsTopLeft,
    description:
      "Have a surface that doesn’t fit a simple map outline? Tell us about it and we’ll work through the right approach with you.",
  },
  {
    title: "Fence cleaning & restoration",
    icon: Fence,
    description:
      "Tell us about the material, size, and condition of your fence so we can assess cleaning and restoration options.",
  },
  {
    title: "Rust removal",
    icon: Droplets,
    description:
      "Specialty staining needs individual attention. Share where the rust appears and what surface is affected for a custom assessment.",
  },
];
export default function Services({ config }: { config: PublicConfig }) {
  return (
    <>
      <section className="page-heading container">
        <p className="eyebrow">A CLEANER WAY TO COME HOME</p>
        <h1>
          Every surface.
          <br />A fresh possibility.
        </h1>
        <p className="page-intro">
          Exterior cleaning for the places you park, walk, gather, and call
          home. Start with an online estimate or tell us about your project.
        </p>
      </section>
      <section className="section section-topless">
        <div className="container">
          <div className="section-heading compact-heading">
            <div>
              <span className="badge">
                <Sparkles size={14} /> Instant online pricing
              </span>
              <h2>Outline it. Get an estimate.</h2>
            </div>
            <p>
              One ${(config.pricing.minimumCents / 100).toFixed(0)} minimum per
              visit, even when you combine services.
            </p>
          </div>
          <div className="service-detail-grid">
            {instant.map((s) => (
              <article className="card service-detail" key={s.id}>
                <span className="icon-tile">
                  <s.icon size={26} />
                </span>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
                <strong className="large-rate">
                  ${(config.pricing.ratesCents[s.id] / 100).toFixed(2)}
                  <small> / sq. ft.</small>
                </strong>
                <p className="muted service-note">{s.note}</p>
                {config.pricing.enabledServices.includes(s.id) ? (
                  <Link to="/quote" className="button button-secondary">
                    Get an instant quote <ArrowUpRight size={17} />
                  </Link>
                ) : (
                  <Link
                    to={`/contact?service=${encodeURIComponent(s.title)}`}
                    className="button button-secondary"
                  >
                    Request a custom quote <ArrowUpRight size={17} />
                  </Link>
                )}
              </article>
            ))}
          </div>
          <p className="pricing-footnote">
            Estimates are preliminary. Staining, access, unusual conditions, and
            projects over {config.pricing.reviewThresholdSqFt.toLocaleString()}{" "}
            sq. ft. require manual review. A request does not book an
            appointment.
          </p>
        </div>
      </section>
      <section className="section soft-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SOME JOBS DESERVE A CLOSER LOOK</p>
              <h2>
                Let’s talk through
                <br />
                your project.
              </h2>
            </div>
            <p>
              These services receive individual estimates, so the price reflects
              your property’s specific needs.
            </p>
          </div>
          <div className="custom-service-grid">
            {custom.map((s) => (
              <article className="custom-service" key={s.title}>
                <s.icon size={28} strokeWidth={1.5} />
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                  <Link
                    to={`/contact?service=${encodeURIComponent(s.title)}`}
                    className="text-link"
                  >
                    Request a custom quote <ArrowUpRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <div className="future-service">
            <span className="badge muted-badge">Planned service</span>
            <h3>Roof soft washing</h3>
            <p>
              Roof cleaning is planned for a future release and is not currently
              available to book. Contact us with questions about future
              availability.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
