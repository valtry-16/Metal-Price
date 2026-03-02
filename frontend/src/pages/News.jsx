import { useEffect, useState } from "react";
import { PROD_API_URL, metalLabelMap } from "../utils/constants";
import { formatMoney, sortMetals } from "../utils/helpers";
import { cachedFetch } from "../lib/apiCache";
import dayjs from "dayjs";

export default function News() {
  const [summary, setSummary] = useState(null);
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      cachedFetch(`${PROD_API_URL}/daily-summary`),
      cachedFetch(`${PROD_API_URL}/get-latest-price`),
    ])
      .then(([summaryData, priceData]) => {
        if (summaryData?.summary) setSummary(summaryData);
        if (priceData?.metals) {
          setPrices(
            sortMetals(priceData.metals.filter((m) => !["BTC", "ETH", "HG"].includes(m.metal_name)))
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const renderSummary = (text) => {
    if (!text) return null;
    return text.split("\n").map((line, i) => {
      if (!line.trim()) return <br key={i} />;
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>");
      return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  return (
    <div className="al-page al-news-page">
      <div className="al-page__header">
        <h1 className="al-page__title">Market News & Insights</h1>
        <p className="al-page__subtitle">AI-generated daily analysis of precious metal markets</p>
      </div>

      {loading ? (
        <div className="al-loading-container">
          <div className="al-loading-orb" />
          <p>Loading market insights...</p>
        </div>
      ) : (
        <div className="al-news__grid">
          {/* AI Summary */}
          <div className="al-news__summary-card">
            <div className="al-news__summary-header">
              <span className="al-news__summary-badge">🤖 AI Summary</span>
              {summary?.date && (
                <span className="al-news__summary-date">
                  {dayjs(summary.date).format("DD MMM YYYY")}
                </span>
              )}
            </div>
            <div className="al-news__summary-content">
              {summary?.summary ? (
                renderSummary(summary.summary)
              ) : (
                <p className="al-news__empty">
                  No market summary available yet. Summaries are generated daily — check back soon.
                </p>
              )}
            </div>
          </div>

          {/* Price Snapshot */}
          <div className="al-news__prices-card">
            <h3 className="al-news__prices-title">Today's Prices</h3>
            <div className="al-news__prices-list">
              {prices.map((m) => (
                <div key={m.metal_name} className="al-news__price-row">
                  <span className="al-news__price-name">{metalLabelMap[m.metal_name] || m.metal_name}</span>
                  <span className="al-news__price-val">
                    {m.price_1g ? formatMoney(m.price_1g) : "—"}
                    <span className="al-news__price-unit">/g</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Market Tips */}
          <div className="al-news__tips-card">
            <h3 className="al-news__tips-title">💡 Quick Tips</h3>
            <ul className="al-news__tips-list">
              <li>Gold prices tend to rise during periods of economic uncertainty.</li>
              <li>Silver has both industrial and investment demand — watch manufacturing data.</li>
              <li>Compare metals over time using the <strong>Comparison Tool</strong>.</li>
              <li>Set price alerts to track threshold crossings automatically.</li>
              <li>Use the AI chatbot on the Market page for instant metal queries.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
