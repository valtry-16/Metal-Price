import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PROD_API_URL, metalLabelMap } from "../utils/constants";
import { formatMoney } from "../utils/helpers";
import { cachedFetch } from "../lib/apiCache";
import dayjs from "dayjs";

export default function Dashboard() {
  const { user } = useAuth();
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

  const displayName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const avatarUrl = user?.user_metadata?.avatar_url;

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
                <img src={avatarUrl} alt="" />
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
            <h3 className="al-dashboard__card-title">💼 Portfolio</h3>
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
              View Portfolio →
            </Link>
          </div>

          {/* Latest Insight */}
          <div className="al-dashboard__card">
            <h3 className="al-dashboard__card-title">🤖 Latest Market Insight</h3>
            {summary?.summary ? (
              <p className="al-dashboard__insight-preview">
                {summary.summary.substring(0, 250)}...
              </p>
            ) : (
              <p className="al-dashboard__insight-empty">No summary available today.</p>
            )}
            <Link to="/news" className="al-btn al-btn--ghost al-btn--sm" style={{ marginTop: "12px" }}>
              Read Full Summary →
            </Link>
          </div>

          {/* Quick Links */}
          <div className="al-dashboard__card">
            <h3 className="al-dashboard__card-title">⚡ Quick Actions</h3>
            <div className="al-dashboard__quick-links">
              <Link to="/market" className="al-dashboard__quick-link">📈 Market</Link>
              <Link to="/calculator" className="al-dashboard__quick-link">💎 Calculator</Link>
              <Link to="/compare" className="al-dashboard__quick-link">⚖️ Compare</Link>
              <Link to="/settings" className="al-dashboard__quick-link">⚙️ Settings</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
