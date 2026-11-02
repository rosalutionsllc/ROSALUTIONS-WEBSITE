import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  MessageSquare,
  HeartHandshake,
  Sparkles,
} from "lucide-react";
import type { PublicConfig } from "../../shared/types";
export default function About({ config }: { config: PublicConfig }) {
  return (
    <>
      <section className="page-heading container">
        <p className="eyebrow">MEET ROSALUTIONS</p>
        <h1>
          A little more care.
          <br />A lot more curb appeal.
        </h1>
        <p className="page-intro">
          Good exterior cleaning starts with understanding the property—and the
          person who calls it home.
        </p>
      </section>
      <section className="section section-topless">
        <div className="container about-grid">
          <div className="about-statement">
            <span className="tiny-line" />
            <h2>
              Thoughtful work.
              <br />
              Clear communication.
              <br />
              <span>A fresher feeling.</span>
            </h2>
            <span className="small-label">
              ROSALUTIONS PRESSURE WASHING · TAMPA BAY
            </span>
          </div>
          <div className="prose">
            <h2>Care for the place you call yours.</h2>
            <p>
              {config.business.description ||
                "Rosalutions Pressure Washing helps homeowners across Tampa Bay refresh their exterior spaces with quality work and clear communication."}
            </p>
            <p>
              We focus on the surfaces that shape everyday life: the driveway
              you pull into, the sidewalk leading to your door, and the patio
              where you spend time outside. Our goal is straightforward—to help
              your property look its best while keeping the process clear and
              comfortable.
            </p>
            <p>
              Our online estimate tool gives you a useful starting point. You
              outline your surfaces, see a preliminary price, and tell us what
              your property needs. We review the request with you before any job
              is confirmed.
            </p>
            <Link className="text-link" to="/contact">
              Tell us about your home <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section className="section soft-section">
        <div className="container">
          <p className="eyebrow">WHAT YOU CAN EXPECT</p>
          <div className="value-grid">
            {[
              {
                icon: Sparkles,
                title: "Attention to the details",
                text: "We take the time to understand your surfaces, staining, and special conditions so each cleaning request receives the right consideration.",
              },
              {
                icon: MessageSquare,
                title: "A clear conversation",
                text: "An estimate should be understandable. We explain the scope, review any unusual conditions, and confirm the details with you.",
              },
              {
                icon: HeartHandshake,
                title: "Respect for your home",
                text: "Share your access instructions and any areas of concern. Your property’s needs help guide how we approach the work.",
              },
            ].map((v) => (
              <article className="value-card" key={v.title}>
                <v.icon size={28} strokeWidth={1.4} />
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container final-cta">
          <div>
            <p className="eyebrow">ROOTED IN TAMPA BAY</p>
            <h2>
              Good neighbors.
              <br />
              Cleaner outdoor spaces.
            </h2>
            <p>
              Serving Tampa, Brandon, Hillsborough County, and nearby
              communities. Contact us to confirm your location.
            </p>
          </div>
          <Link to="/quote" className="button">
            Start with a free estimate <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
