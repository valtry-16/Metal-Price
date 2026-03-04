import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PROD_API_URL, metalLabelMap } from "../utils/constants";
import { formatMoney, sortMetals } from "../utils/helpers";
import { cachedFetch } from "../lib/apiCache";

const FEATURES = [
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>),
    title: "Live Market Data",
    desc: "Real-time prices for Gold, Silver, Platinum, Palladium, and base metals — updated every hour from MCX feeds.",
  },
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>),
    title: "Portfolio Simulator",
    desc: "Simulate metal investments with a virtual ₹10 Lakh balance. Track P&L, trade history, and performance charts.",
  },
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>),
    title: "Jewellery Calculator",
    desc: "Compute jewellery prices with purity, making charges, and GST breakdown — perfect for gold buyers.",
  },
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>),
    title: "Metal Comparison",
    desc: "Compare price movements across metals side-by-side with interactive charts and historical data.",
  },
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
    title: "AI Market Insights",
    desc: "Daily AI-generated summaries and a smart chatbot that answers questions about metal markets.",
  },
  {
    icon: (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
    title: "Export & Reports",
    desc: "Download market data as CSV or beautifully formatted PDF reports with charts and statistics.",
  },
];

const TOOLS = [
  { title: "Portfolio Simulator", desc: "Virtual metal trading", path: "/portfolio", icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>) },
  { title: "Jewellery Calculator", desc: "Price with making & GST", path: "/calculator", icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>) },
  { title: "Metal Comparison", desc: "Side-by-side analysis", path: "/compare", icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>) },
  { title: "AI Chatbot", desc: "Ask anything about metals", path: "#chatbot", icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>) },
];

export default function Home() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedFetch(`${PROD_API_URL}/get-latest-price`)
      .then((data) => {
        if (data?.metals) {
          const sorted = sortMetals(
            data.metals.filter((m) => !["BTC", "ETH", "HG"].includes(m.metal_name))
          );
          setPrices(sorted.slice(0, 6));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="al-home">
      {/* ─── Hero ──────────────────────────────────── */}
      <section className="al-hero">
        <div className="al-hero__bg-accent" />
        <div className="al-hero__content">
          <div className="al-hero__badge">Precious Metals Intelligence</div>
          <h1 className="al-hero__title">
            Track precious metals with{" "}
            <span className="al-hero__highlight">real-time analytics</span>
          </h1>
          <p className="al-hero__subtitle">
            Live market data, portfolio simulation, AI insights, and professional
            tools — all in one elegant platform built for the Indian market.
          </p>
          <div className="al-hero__actions">
            <Link to="/market" className="al-btn al-btn--primary al-btn--lg">
              View Market
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
            <Link to="/portfolio" className="al-btn al-btn--ghost al-btn--lg">
              Explore Tools
            </Link>
          </div>
        </div>

        {/* Live price preview */}
        <div className="al-hero__prices">
          <div className="al-hero__prices-header">
            <span className="al-hero__prices-dot" />
            Live Prices
          </div>
          <div className="al-hero__prices-grid">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="al-price-card al-price-card--skeleton">
                    <div className="al-skeleton al-skeleton--sm" />
                    <div className="al-skeleton al-skeleton--lg" />
                  </div>
                ))
              : prices.map((m) => (
                  <div key={m.metal_name} className="al-price-card">
                    <span className="al-price-card__name">
                      {metalLabelMap[m.metal_name] || m.metal_name}
                      {m.metal_name === "XAU" && <span className="al-price-card__purity"> 22K</span>}
                    </span>
                    <span className="al-price-card__price">
                      {m.price_1g ? formatMoney(m.price_1g) : "—"}
                    </span>
                    <span className="al-price-card__unit">/gram</span>
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────── */}
      <section className="al-section">
        <div className="al-section__header">
          <span className="al-section__badge">Features</span>
          <h2 className="al-section__title">Everything you need for metals intelligence</h2>
          <p className="al-section__subtitle">
            Professional-grade tools wrapped in an elegant interface, designed for
            investors, jewellers, and enthusiasts.
          </p>
        </div>
        <div className="al-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="al-feature-card">
              <span className="al-feature-card__icon">{f.icon}</span>
              <h3 className="al-feature-card__title">{f.title}</h3>
              <p className="al-feature-card__desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Tools CTA ────────────────────────────── */}
      <section className="al-section al-section--alt">
        <div className="al-section__header">
          <span className="al-section__badge">Tools</span>
          <h2 className="al-section__title">Powerful tools at your fingertips</h2>
          <p className="al-section__subtitle">
            From portfolio simulation to jewellery pricing — explore the complete toolkit.
          </p>
        </div>
        <div className="al-tools-grid">
          {TOOLS.map((t) =>
            t.path === "#chatbot" ? (
              <button
                key={t.title}
                className="al-tool-card"
                onClick={() => {
                  const fab = document.querySelector(".chat-fab");
                  if (fab) fab.click();
                }}
              >
                <span className="al-tool-card__icon">{t.icon}</span>
                <div>
                  <h3 className="al-tool-card__title">{t.title}</h3>
                  <p className="al-tool-card__desc">{t.desc}</p>
                </div>
                <svg className="al-tool-card__arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            ) : (
              <Link key={t.title} to={t.path} className="al-tool-card">
                <span className="al-tool-card__icon">{t.icon}</span>
                <div>
                  <h3 className="al-tool-card__title">{t.title}</h3>
                  <p className="al-tool-card__desc">{t.desc}</p>
                </div>
                <svg className="al-tool-card__arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </Link>
            )
          )}
        </div>
      </section>

      {/* ─── CTA Banner ───────────────────────────── */}
      <section className="al-cta-banner">
        <div className="al-cta-banner__inner">
          <h2 className="al-cta-banner__title">Ready to start tracking?</h2>
          <p className="al-cta-banner__desc">
            Join Auric Ledger and get access to real-time market data, portfolio
            simulation, and AI-powered insights — completely free.
          </p>
          <div className="al-cta-banner__actions">
            <Link to="/market" className="al-btn al-btn--primary al-btn--lg">
              Open Market Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
