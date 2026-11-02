import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  MoveUpRight,
  MapPin,
  MousePointer2,
  Sparkles,
  House,
  Footprints,
  Sun,
  ChevronRight,
} from "lucide-react";
import type { PublicConfig } from "../../shared/types";

function PropertyIllustration() {
  return (
    <div className="property-art">
      <div className="art-topline">
        <span className="status-dot" /> A FRESH PERSPECTIVE ON YOUR PROPERTY{" "}
        <span>01 / 03</span>
      </div>
      <svg
        viewBox="0 0 680 590"
        className="property-svg"
        role="img"
        aria-label="Illustration of a home with a blue driveway outline, demonstrating the online measurement tool"
      >
        <defs>
          <linearGradient id="lawn" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#558b91" />
            <stop offset="1" stopColor="#254d56" />
          </linearGradient>
          <linearGradient id="drive" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#92b5c4" />
            <stop offset="1" stopColor="#d0e6ee" />
          </linearGradient>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#357688"
              strokeWidth=".45"
              opacity=".25"
            />
          </pattern>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="3"
              dy="14"
              stdDeviation="12"
              floodColor="#00070f"
              floodOpacity=".18"
            />
          </filter>
        </defs>
        <rect width="680" height="590" fill="#17303d" />
        <rect width="680" height="590" fill="url(#grid)" />
        <path d="M-50 416 460 125 760 296 250 592Z" fill="#315463" />
        <path d="M12 390 402 167 652 310 260 535Z" fill="url(#lawn)" />
        <path d="M-20 451 505 150 539 171 14 472Z" fill="#7896a6" />
        <path d="M-20 481 515 175 765 318 232 623Z" fill="#385767" />
        <path
          d="M-20 506 540 185"
          stroke="#95b6c8"
          strokeWidth="3"
          strokeDasharray="38 28"
        />
        <path d="M337 325 430 274 571 355 477 410Z" fill="url(#drive)" />
        <path
          d="M338 327 430 274 571 355 477 410Z"
          fill="#00c5f4"
          fillOpacity=".23"
          stroke="#00c5f4"
          strokeWidth="3"
          strokeDasharray="7 5"
        />
        <path
          d="M110 277 270 185 435 280 274 373Z"
          fill="#0c2633"
          opacity=".28"
          transform="translate(22 20)"
        />
        <g filter="url(#shadow)">
          <path d="M143 258 291 173 426 250 278 335Z" fill="#dae5e9" />
          <path d="M143 258 278 335 278 260 143 182Z" fill="#dae5e9" />
          <path d="M278 335 426 250 426 175 278 260Z" fill="#9eb4c1" />
          <path d="M120 189 268 103 447 176 299 261Z" fill="#142331" />
          <path d="M120 189 268 103 293 175 299 261Z" fill="#213847" />
          <path d="M293 175 447 176 299 261Z" fill="#0d202e" />
          <path d="M268 103 447 176 293 175Z" fill="#38505e" />
          <path d="M160 229 184 242 184 278 160 264Z" fill="#43a5c1" />
          <path d="M206 256 230 270 230 306 206 292Z" fill="#43a5c1" />
          <path d="M305 272 405 215 405 252 305 309Z" fill="#7895a6" />
          <path
            d="M305 283 405 226M305 294 405 237"
            stroke="#9eb4c1"
            strokeWidth="2"
          />
          <path
            d="M342 128 342 91 365 78 388 91 388 146 367 157Z"
            fill="#a4bdc8"
          />
          <path d="M342 91 365 78 388 91 365 104Z" fill="#c7dce4" />
          <path d="M365 104 388 91 388 146 365 158Z" fill="#7699ab" />
        </g>
        <g fill="#28595b">
          <circle cx="118" cy="328" r="30" />
          <circle cx="100" cy="317" r="22" fill="#35716f" />
          <circle cx="113" cy="303" r="20" fill="#4c8c85" />
          <circle cx="483" cy="242" r="26" />
          <circle cx="474" cy="227" r="23" fill="#4c8c85" />
          <circle cx="318" cy="422" r="34" />
          <circle cx="301" cy="404" r="27" fill="#37746f" />
          <circle cx="324" cy="396" r="24" fill="#56968e" />
        </g>
        <g fill="white" stroke="#00c5f4" strokeWidth="3">
          <circle cx="338" cy="327" r="5" />
          <circle cx="430" cy="274" r="5" />
          <circle cx="571" cy="355" r="5" />
          <circle cx="477" cy="410" r="5" />
        </g>
        <path
          d="M491 389 491 413 497 406 504 420 509 417 502 403 512 402Z"
          fill="white"
          stroke="#123b64"
          strokeWidth="1.5"
        />
        <g transform="translate(43 477)">
          <circle r="21" fill="#cce4ed" />
          <path d="m0-11 6 18-6-4-6 4Z" fill="#143c4d" />
          <text
            y="-29"
            textAnchor="middle"
            fill="#143c4d"
            fontSize="10"
            fontFamily="Arial"
          >
            N
          </text>
        </g>
      </svg>
      <div className="art-measure">
        <span className="measure-icon">
          <MousePointer2 size={20} />
        </span>
        <div>
          <strong>Your driveway. Your estimate.</strong>
          <span>Outline it. Measure it. See the price.</span>
        </div>
        <Check size={19} />
      </div>
      <span className="art-caption">
        Property illustration · Your actual property appears in satellite view
      </span>
    </div>
  );
}

export default function Home({ config }: { config: PublicConfig }) {
  const minimum = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(config.pricing.minimumCents / 100);
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-line" /> TAMPA BAY’S FRESH START
            </p>
            <h1>
              Goodbye grime.
              <br />
              Hello, <span>curb appeal.</span>
            </h1>
            <p className="hero-description">
              A cleaner driveway. A brighter patio. A home that feels like yours
              again. Professional exterior cleaning throughout Tampa Bay.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/quote">
                Get my instant quote <ArrowUpRight size={19} />
              </Link>
              <Link className="text-link" to="/services">
                Explore our services <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-reassurance">
              <span>
                <Check size={15} /> Free online estimates
              </span>
              <span>
                <Check size={15} /> No appointment commitment
              </span>
            </div>
          </div>
          <PropertyIllustration />
        </div>
      </section>
      <div className="promise-strip">
        <div className="container promise-inner">
          <span>
            <Sparkles size={19} /> A little care. A noticeable difference.
          </span>
          <span>Driveways</span>
          <span>Sidewalks</span>
          <span>Patios</span>
          <span>Exterior surfaces</span>
        </div>
      </div>
      <section className="section services-preview">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ROOM FOR A REFRESH</p>
              <h2>
                Clean surfaces.
                <br />
                Better first impressions.
              </h2>
            </div>
            <div>
              <p>
                Florida weather leaves its mark. We help you make the most of
                the outdoor spaces you enjoy every day.
              </p>
              <Link className="text-link" to="/services">
                All cleaning services <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
          <div className="service-grid">
            {[
              {
                title: "Driveway cleaning",
                icon: House,
                type: "driveway",
                text: "Welcome yourself home to a driveway free of everyday dirt and surface buildup.",
                className: "driveway",
              },
              {
                title: "Sidewalk cleaning",
                icon: Footprints,
                type: "sidewalk",
                text: "Give the paths around your property the attention they deserve.",
                className: "sidewalk",
              },
              {
                title: "Patio cleaning",
                icon: Sun,
                type: "patio",
                text: "Make more room for slow mornings, weekend gatherings, and time outside.",
                className: "patio",
              },
            ].map((s, i) => (
              <Link to="/quote" className="service-card" key={s.title}>
                <div className={`surface-art surface-${s.className}`}>
                  <s.icon size={38} strokeWidth={1.2} />
                  <span className="surface-number">0{i + 1}</span>
                </div>
                <div className="service-card-body">
                  <span className="small-label">INSTANT ONLINE ESTIMATE</span>
                  <h3>
                    {s.title}
                    <MoveUpRight size={20} />
                  </h3>
                  <p>{s.text}</p>
                  <span className="service-rate">
                    $
                    {(
                      config.pricing.ratesCents[
                        s.type as keyof typeof config.pricing.ratesCents
                      ] / 100
                    ).toFixed(2)}{" "}
                    / sq. ft.
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <p className="pricing-footnote">
            One {minimum} minimum per visit, shared across all selected
            surfaces. Final pricing is confirmed after review.
          </p>
        </div>
      </section>
      <section className="how-section section">
        <div className="container how-grid">
          <div>
            <p className="eyebrow">LESS GUESSWORK. MORE CLARITY.</p>
            <h2>
              Your property.
              <br />
              Your outline.
              <br />
              <span>Your estimate.</span>
            </h2>
            <p>
              See a preliminary price before sharing your contact information.
              No measuring tape. No account to create.
            </p>
            <Link to="/quote" className="button">
              Try the instant quote tool <ArrowUpRight size={18} />
            </Link>
          </div>
          <ol className="how-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Find your home</h3>
                <p>
                  Search your address to see your property on a satellite map.
                </p>
              </div>
              <MapPin size={23} />
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Outline what needs cleaning</h3>
                <p>
                  Tap around your driveway, sidewalk, or patio. Add as many
                  separate areas as you need.
                </p>
              </div>
              <MousePointer2 size={23} />
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>See your price. Send your request.</h3>
                <p>
                  Review your estimate, then send it our way. We’ll follow up to
                  confirm the details.
                </p>
              </div>
              <ArrowUpRight size={23} />
            </li>
          </ol>
        </div>
      </section>
      <section className="section">
        <div className="container local-grid">
          <div className="local-art" aria-hidden="true">
            <span className="local-ring ring-one" />
            <span className="local-ring ring-two" />
            <span className="local-ring ring-three" />
            <div className="local-center">
              <MapPin size={36} />
              <strong>Tampa Bay</strong>
              <span>HOME LOOKS GOOD HERE.</span>
            </div>
            <span className="local-place place-one">TAMPA</span>
            <span className="local-place place-two">BRANDON</span>
            <span className="local-place place-three">HILLSBOROUGH COUNTY</span>
          </div>
          <div>
            <p className="eyebrow">LOCAL CARE, THROUGH AND THROUGH</p>
            <h2>
              For the homes
              <br />
              of Tampa Bay.
            </h2>
            <p>
              From Tampa to Brandon and across Hillsborough County, Rosalutions
              brings clear communication and thoughtful care to your exterior
              cleaning project.
            </p>
            <p className="muted">
              In Clearwater, St. Petersburg, or another nearby community? Send
              us your address and we’ll confirm service availability.
            </p>
            <Link to="/about" className="text-link">
              A little about Rosalutions <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </section>
      <section className="gallery-teaser">
        <div className="container gallery-teaser-inner">
          <div>
            <p className="eyebrow">THE DIFFERENCE IS IN THE DETAILS</p>
            <h2>Real surfaces. Real transformations.</h2>
            <p>
              Our project gallery is growing. Explore our before-and-after
              gallery as new work is added.
            </p>
          </div>
          <Link to="/gallery" className="button button-secondary">
            View our work <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="section">
        <div className="container final-cta">
          <div>
            <p className="eyebrow">LET’S MAKE IT SHINE</p>
            <h2>
              A fresh start is
              <br />a few clicks away.
            </h2>
            <p>
              Find out what a cleaner outdoor space could look like for your
              budget.
            </p>
          </div>
          <div className="final-cta-actions">
            <Link to="/quote" className="button">
              Get my instant quote <ArrowUpRight size={19} />
            </Link>
            <Link to="/contact" className="text-link">
              Have a different project? Let’s talk <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
