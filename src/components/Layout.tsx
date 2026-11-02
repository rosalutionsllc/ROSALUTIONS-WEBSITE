import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X, Phone, Mail, MapPin } from "lucide-react";
import type { PublicConfig } from "../../shared/types";

export default function Layout({
  config,
  children,
}: {
  config: PublicConfig;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { business } = config;
  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>
            <MapPin size={13} aria-hidden="true" /> Proudly serving{" "}
            {business.serviceArea}
          </span>
          <a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}>
            {business.phone} <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label={`${business.name} home`}>
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={business.name}
                className="brand-logo"
                width="2168"
                height="724"
                fetchPriority="high"
              />
            ) : (
              <span className="brand-text">
                {business.name.replace(/ Pressure Washing$/i, "")}
                <span>PRESSURE WASHING</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            className="mobile-menu"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="primary-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            id="primary-nav"
            className={`primary-nav ${open ? "is-open" : ""}`}
            aria-label="Main navigation"
          >
            <NavLink to="/services">Services</NavLink>
            <NavLink to="/about">About us</NavLink>
            <NavLink to="/gallery">Our work</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            <Link to="/quote" className="button header-cta">
              Get an instant quote <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Link className="brand footer-brand" to="/">
              {business.logoUrl ? (
                <img
                  src={business.logoUrl}
                  alt={business.name}
                  className="brand-logo"
                  width="2168"
                  height="724"
                  loading="lazy"
                />
              ) : (
                <span className="brand-text">
                  {business.name.replace(/ Pressure Washing$/i, "")}
                  <span>PRESSURE WASHING</span>
                </span>
              )}
            </Link>
            <p>
              A fresh start for the place
              <br />
              you call home.
            </p>
            <p className="footer-location">
              <MapPin size={16} aria-hidden="true" /> {business.serviceArea}
            </p>
          </div>
          <div>
            <h2>Explore</h2>
            <Link to="/services">Our services</Link>
            <Link to="/quote">Get an instant quote</Link>
            <Link to="/about">About Rosalutions</Link>
            <Link to="/gallery">Before & after</Link>
          </div>
          <div>
            <h2>Let’s talk</h2>
            <a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}>
              <Phone size={15} aria-hidden="true" />
              {business.phone}
            </a>
            <a href={`mailto:${business.email}`}>
              <Mail size={15} aria-hidden="true" />
              {business.email}
            </a>
            <Link to="/contact">
              Request a custom quote{" "}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            {business.googleBusinessUrl && (
              <a
                href={business.googleBusinessUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Find us on Google <ArrowUpRight size={15} />
              </a>
            )}
            {business.socialUrls.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                Social profile {i + 1} <ArrowUpRight size={15} />
              </a>
            ))}
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} {business.name}
          </span>
          <div>
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/admin">Owner login</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
