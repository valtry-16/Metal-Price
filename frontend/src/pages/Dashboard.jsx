import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PROD_API_URL, metalLabelMap } from "../utils/constants";
import { formatMoney } from "../utils/helpers";
import { cachedFetch } from "../lib/apiCache";
import dayjs from "dayjs";

export default function Dashboard() {
  const { user, getDisplayName, getAvatarUrl } = useAuth();
  const [summary, setSummary] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = localStorage.getItem("auric-portfolio-uid");
    Promise.all([
      cachedFetch(`${PROD_API_URL}/daily-summary`),
      uid
        ? cachedFetch(`${PROD_API_URL}/api/portfolio?userId=${uid}`)
        : Promise.resolve(null),
    ]).then(([s, p]) => {
      setSummary(s);
      setPortfolioData(p);
      setLoading(false);
    });
  }, []);

  const displayName = getDisplayName();
  const avatarUrl = getAvatarUrl();

  const balance = portfolioData?.balance ?? 1000000;
  const activeHoldings = portfolioData?.holdings?.filter((h) => !h.is_sold) || [];
  const totalInvested = activeHoldings.reduce((s, h) => s + (h.total_cost || 0), 0);

  return (
    <div className="al-page al-dashboard-page">
      <div className="al-page__header">
        <h1 className="al-page__title">Dashboard</h1>
        <p className="al-page__subtitle">Your personal overview</p>
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
          </div>

          {/* Portfolio Summary */}
          <div className="al-dashboard__card">
            <h3 className="al-dashboard__card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              Portfolio
            </h3>
            <div className="al-dashboard__stat-row">
              <div className="al-dashboard__stat">
                <span className="al-dashboard__stat-label">Virtual Balance</span>
                <span className="al-dashboard__stat-value">{formatMoney(balance)}</span>
              </div>
              <div className="al-dashboard__stat">
                <span className="al-dashboard__stat-label">Invested</span>
                <span className="al-dashboard__stat-value">{formatMoney(totalInvested)}</span>
              </div>
              <div className="al-dashboard__stat">
                <span className="al-dashboard__stat-label">Active Holdings</span>
                <span className="al-dashboard__stat-value">{activeHoldings.length}</span>
              </div>
            </div>
            <Link to="/portfolio" className="al-btn al-btn--ghost al-btn--sm" style={{ marginTop: "12px" }}>
              View Portfolio
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>

          {/* Latest Insight */}
          <div className="al-dashboard__card">
            <h3 className="al-dashboard__card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Latest Market Insight
            </h3>
            {summary?.summary ? (
              <p className="al-dashboard__insight-preview">
                {summary.summary.substring(0, 250)}...
              </p>
            ) : (
              <p className="al-dashboard__insight-empty">No summary available today.</p>
            )}
            <Link to="/news" className="al-btn al-btn--ghost al-btn--sm" style={{ marginTop: "12px" }}>
              Read Full Summary
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
              <Link to="/settings" className="al-dashboard__quick-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
