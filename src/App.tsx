import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import type { PublicConfig } from "../shared/types";
import { api } from "./api";
import { PAGE_META } from "../shared/seo";
import Layout from "./components/Layout";
import Home from "./pages/Home";
const Services = lazy(() => import("./pages/Services"));
const About = lazy(() => import("./pages/About"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Contact = lazy(() => import("./pages/Contact"));
const Quote = lazy(() => import("./pages/Quote"));
const Receipt = lazy(() => import("./pages/Receipt"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminQuote = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.AdminQuote })),
);
const Privacy = lazy(() =>
  import("./pages/Legal").then((m) => ({ default: m.PrivacyPage })),
);
const Terms = lazy(() =>
  import("./pages/Legal").then((m) => ({ default: m.TermsPage })),
);
function Metadata({ config }: { config: PublicConfig }) {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = PAGE_META[pathname];
    document.title = `${meta?.title || (pathname.startsWith("/admin") ? "Owner Dashboard" : "Rosalutions")} | ${config.business.name}`;
    if (meta)
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute("content", meta.description);
  }, [pathname, config.business.name]);
  return null;
}
export default function App() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<PublicConfig>("/api/config")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <div className="startup-message">
        <h1>We couldn’t load the website.</h1>
        <p>{error}</p>
        <button className="button" onClick={() => window.location.reload()}>
          Try again
        </button>
        <p>
          Email{" "}
          <a href="mailto:rosalutionsllc@gmail.com">rosalutionsllc@gmail.com</a>{" "}
          for help.
        </p>
      </div>
    );
  if (!config)
    return (
      <div className="startup-message" role="status">
        Getting things ready…
      </div>
    );
  return (
    <BrowserRouter>
      <Metadata config={config} />
      <Layout config={config}>
        <Suspense
          fallback={
            <div className="container section" role="status">
              Loading…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home config={config} />} />
            <Route path="/services" element={<Services config={config} />} />
            <Route path="/about" element={<About config={config} />} />
            <Route path="/gallery" element={<Gallery config={config} />} />
            <Route path="/contact" element={<Contact config={config} />} />
            <Route path="/quote" element={<Quote config={config} />} />
            <Route
              path="/quote/received"
              element={<Receipt config={config} />}
            />
            <Route path="/admin" element={<Admin config={config} />} />
            <Route
              path="/admin/quotes/:id"
              element={<AdminQuote config={config} />}
            />
            <Route path="/privacy" element={<Privacy config={config} />} />
            <Route path="/terms" element={<Terms config={config} />} />
            <Route
              path="*"
              element={
                <section className="container section">
                  <h1>That page isn’t here.</h1>
                  <Link to="/" className="button">
                    Back to home
                  </Link>
                </section>
              }
            />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
