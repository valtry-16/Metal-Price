import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PROD_API_URL, metalLabelMap } from "../utils/constants";
import { formatMoney, sortMetals } from "../utils/helpers";
import { cachedFetch } from "../lib/apiCache";
import dayjs from "dayjs";

export default function Dashboard() {
  const { user, getDisplayName, getAvatarUrl } = useAuth();
  const [summary, setSummary] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [metals, setMetals] = useState([]);
  const [comparisons, setComparisons] = useState({});
  const [loading, setLoading] = useState(true);

  /** Strip markdown syntax for plain-text preview */
  const stripMarkdown = (md) =>
    md
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/~~(.*?)~~/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/\n{2,}/g, " ")
      .trim();

  useEffect(() => {
    const uid = user?.id;
    Promise.all([
      cachedFetch(`${PROD_API_URL}/daily-summary`),
      uid ? cachedFetch(`${PROD_API_URL}/api/portfolio?userId=${uid}`) : Promise.resolve(null),
      cachedFetch(`${PROD_API_URL}/get-latest-price`),
    ]).then(async ([s, p, priceData]) => {
      setSummary(s);
      setPortfolioData(p);
      const filtered = sortMetals((priceData?.metals || []).filter((m) => !["BTC", "ETH", "HG"].includes(m.metal_name)));
      setMetals(filtered);

      // Fetch comparisons for top metals
      const compMap = {};
      await Promise.all(
        filtered.slice(0, 6).map(async (metal) => {
          try {
            const cp = metal.metal_name === "XAU" ? "&carat=22" : "";
            const r = await fetch(`${PROD_API_URL}/compare-yesterday?metal=${encodeURIComponent(metal.metal_name)}${cp}`);
            if (r.ok) { const d = await r.json(); compMap[metal.metal_name] = d.comparison; }
          } catch {}
        })
      );
      setComparisons(compMap);
      setLoading(false);
    });
  }, [user]);

  const displayName = getDisplayName();
  const avatarUrl = getAvatarUrl();

  const balance = portfolioData?.balance ?? 1000000;
  const activeHoldings = portfolioData?.holdings?.filter((h) => !h.is_sold) || [];
  const totalInvested = activeHoldings.reduce((s, h) => s + (h.total_cost || 0), 0);
  const soldHoldings = portfolioData?.holdings?.filter((h) => h.is_sold) || [];
  const totalProfit = soldHoldings.reduce((s, h) => s + ((h.sell_total || 0) - (h.total_cost || 0)), 0);

  // Alerts from localStorage
  const savedAlerts = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auric-alerts") || "[]"); } catch { return []; }
  }, []);

  // User preferences
  const defaultMetal = localStorage.getItem("auric-metal") || "XAU";
  const defaultCarat = localStorage.getItem("auric-carat") || "22";
  const theme = localStorage.getItem("auric-theme") || "dark";

  // Market movers
  const marketMovers = useMemo(() => {
    return metals.slice(0, 6).map((m) => {
      const comp = comparisons[m.metal_name];
      const today = comp?.today_prices?.price_1g;
      const yesterday = comp?.yesterday_prices?.price_1g;
      const diff = today && yesterday ? today - yesterday : 0;
      const pct = yesterday ? ((diff / yesterday) * 100) : 0;
      return {
        symbol: m.metal_name,
        label: metalLabelMap[m.metal_name] || m.metal_name,
        price: m.price_1g,
        diff,
        pct,
        direction: diff > 0 ? "up" : diff < 0 ? "down" : "neutral",
      };
    });
  }, [metals, comparisons]);

  return (
    <div className="al-page al-dashboard-page">
      <div className="al-page__header">
        <h1 className="al-page__title">Dashboard</h1>
        <p className="al-page__subtitle">Your personal overview &bull; {dayjs().format("DD MMM YYYY")}</p>
      </div>

      {loading ? (
        <div className="al-loading-container">
          <div className="al-loading-orb" />
          <p>Loading dashboard...</p>
        </div>
      ) : (
        <div className="al-dashboard__grid">
          {/* Welcome Card */}
          <div className="al-dashboard__welcome">
            <div className="al-dashboard__avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} />
              ) : (
                <span>{displayName[0].toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2 className="al-dashboard__greeting">Welcome, {displayName}</h2>
              <p className="al-dashboard__email">{user?.email}</p>
              <p className="al-dashboard__joined">
                Member since {dayjs(user?.created_at).format("MMM YYYY")}
              </p>
            </div>
            <div className="al-dashboard__welcome-meta">
              <span className="al-dashboard__meta-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>
                {theme === "dark" ? "Dark" : "Light"} Mode
              </span>
              <span className="al-dashboard__meta-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                {metalLabelMap[defaultMetal] || defaultMetal} {defaultMetal === "XAU" ? `${defaultCarat}K` : ""}
              </span>
              <span className="al-dashboard__meta-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {savedAlerts.length} Alert{savedAlerts.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Portfolio Summary */}
          <div className="al-dashboard__card">
            <h3 className="al-dashboard__card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              Portfolio Overview
            </h3>
            <div className="al-dashboard__stat-row">
              <div className="al-dashboard__stat">
                <span className="al-dashboard__stat-label">Balance</span>
                <span className="al-dashboard__stat-value">{formatMoney(balance)}</span>
              </div>
              <div className="al-dashboard__stat">
                <span className="al-dashboard__stat-label">Invested</span>
                <span className="al-dashboard__stat-value">{formatMoney(totalInvested)}</span>
              </div>
              <div className="al-dashboard__stat">
                <span className="al-dashboard__stat-label">Holdings</span>
                <span className="al-dashboard__stat-value">{activeHoldings.length}</span>
              </div>
            </div>
            {activeHoldings.length > 0 && (
              <div className="al-dashboard__holdings-list">
                {activeHoldings.slice(0, 4).map((h, i) => (
                  <div key={i} className="al-dashboard__holding-row">
                    <span className="al-dashboard__holding-metal">{metalLabelMap[h.metal_name] || h.metal_name}</span>
                    <span className="al-dashboard__holding-qty">{h.quantity}g</span>
                    <span className="al-dashboard__holding-cost">{formatMoney(h.total_cost)}</span>
                  </div>
                ))}
                {activeHoldings.length > 4 && (
                  <span className="al-dashboard__holding-more">+{activeHoldings.length - 4} more</span>
                )}
              </div>
            )}
            {soldHoldings.length > 0 && (
              <div className="al-dashboard__profit-line">
                <span>Realized P&L</span>
                <span className={totalProfit >= 0 ? "up" : "down"}>
                  {totalProfit >= 0 ? "+" : ""}{formatMoney(totalProfit)}
                </span>
              </div>
            )}
            <Link to="/portfolio" className="al-btn al-btn--ghost al-btn--sm" style={{ marginTop: "12px" }}>
              View Portfolio
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>

          {/* Market Snapshot */}
          <div className="al-dashboard__card al-dashboard__card--wide">
            <h3 className="al-dashboard__card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Market Snapshot
            </h3>
            <div className="al-dashboard__market-grid">
              {marketMovers.map((m) => (
                <div key={m.symbol} className={`al-dashboard__market-item ${m.direction}`}>
                  <div className="al-dashboard__market-label">{m.label}</div>
                  <div className="al-dashboard__market-price">{formatMoney(m.price)}</div>
                  <div className={`al-dashboard__market-change ${m.direction}`}>
                    {m.direction === "up" ? "+" : ""}{m.pct.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
            <Link to="/market" className="al-btn al-btn--ghost al-btn--sm" style={{ marginTop: "12px" }}>
              View Full Market
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>

          {/* Latest Insight */}
          <div className="al-dashboard__card">
            <h3 className="al-dashboard__card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              AI Market Insight
            </h3>
            {summary?.summary ? (
              <p className="al-dashboard__insight-preview">
                {stripMarkdown(summary.summary).substring(0, 250)}...
              </p>
            ) : (
              <p className="al-dashboard__insight-empty">No summary available today.</p>
            )}
            <Link to="/summary" className="al-btn al-btn--ghost al-btn--sm" style={{ marginTop: "12px" }}>
              Read Full Summary
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>

          {/* Active Alerts */}
          <div className="al-dashboard__card">
            <h3 className="al-dashboard__card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              Price Alerts
            </h3>
            {savedAlerts.length > 0 ? (
              <div className="al-dashboard__alerts-list">
                {savedAlerts.slice(0, 5).map((a) => (
                  <div key={a.id} className={`al-dashboard__alert-row ${a.enabled ? "" : "disabled"}`}>
                    <span className="al-dashboard__alert-metal">{metalLabelMap[a.metal] || a.metal}</span>
                    <span className="al-dashboard__alert-type">
                      {a.type === "price_threshold" ? `${a.direction === "above" ? "Above" : "Below"} ${formatMoney(a.value)}` : `${a.value}% change`}
                    </span>
                    <span className={`al-dashboard__alert-status ${a.enabled ? "active" : ""}`}>
                      {a.enabled ? "Active" : "Paused"}
                    </span>
                  </div>
                ))}
                {savedAlerts.length > 5 && (
                  <span className="al-dashboard__holding-more">+{savedAlerts.length - 5} more alerts</span>
                )}
              </div>
            ) : (
              <p className="al-dashboard__insight-empty">No alerts configured yet.</p>
            )}
            <Link to="/market" className="al-btn al-btn--ghost al-btn--sm" style={{ marginTop: "12px" }}>
              Manage Alerts
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>

          {/* Quick Links */}
          <div className="al-dashboard__card">
            <h3 className="al-dashboard__card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Quick Actions
            </h3>
            <div className="al-dashboard__quick-links">
              <Link to="/market" className="al-dashboard__quick-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Market
              </Link>
              <Link to="/calculator" className="al-dashboard__quick-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Calculator
              </Link>
              <Link to="/compare" className="al-dashboard__quick-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Compare
              </Link>
              <Link to="/news" className="al-dashboard__quick-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                News
              </Link>
              <Link to="/settings" className="al-dashboard__quick-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
              </Link>
              <Link to="/faq" className="al-dashboard__quick-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                FAQ
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
