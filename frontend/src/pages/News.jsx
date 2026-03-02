import { useEffect, useState } from "react";
import { PROD_API_URL, metalLabelMap } from "../utils/constants";
import { formatMoney, sortMetals } from "../utils/helpers";
import { cachedFetch } from "../lib/apiCache";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function News() {
  const [summary, setSummary] = useState(null);
  const [prices, setPrices] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);

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

  useEffect(() => {
    setNewsLoading(true);
    cachedFetch(`${PROD_API_URL}/news-articles`)
      .then((data) => {
        if (data?.articles) {
          setArticles(data.articles);
        }
      })
      .catch(() => {
        setNewsError("Unable to load news articles.");
      })
      .finally(() => setNewsLoading(false));
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

  const truncate = (str, len = 120) => {
    if (!str) return "";
    const cleaned = str.replace(/\[\+\d+ chars\]$/, "").trim();
    return cleaned.length > len ? cleaned.slice(0, len) + "..." : cleaned;
  };

  return (
    <div className="al-page al-news-page">
      <div className="al-page__header">
        <h1 className="al-page__title">Market News & Insights</h1>
        <p className="al-page__subtitle">Real-time precious metals news and AI-powered market analysis</p>
      </div>

      {loading ? (
        <div className="al-loading-container">
          <div className="al-loading-orb" />
          <p>Loading market insights...</p>
        </div>
      ) : (
        <>
          {/* Top row: AI Summary + Sidebar */}
          <div className="al-news__grid">
            {/* AI Summary */}
            <div className="al-news__summary-card">
              <div className="al-news__summary-header">
                <span className="al-news__summary-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  AI Summary
                </span>
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
              <h3 className="al-news__tips-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>
                Quick Tips
              </h3>
              <ul className="al-news__tips-list">
                <li>Gold prices tend to rise during periods of economic uncertainty.</li>
                <li>Silver has both industrial and investment demand — watch manufacturing data.</li>
                <li>Compare metals over time using the <strong>Comparison Tool</strong>.</li>
                <li>Set price alerts to track threshold crossings automatically.</li>
                <li>Use the AI chatbot on the Market page for instant metal queries.</li>
              </ul>
            </div>
          </div>

          {/* News Articles Section */}
          <div className="al-news__articles-section">
            <div className="al-news__articles-header">
              <h2 className="al-news__articles-heading">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                Latest Precious Metals News
              </h2>
              <span className="al-news__articles-count">
                {articles.length} articles
              </span>
            </div>

            {newsLoading ? (
              <div className="al-news__articles-loading">
                <div className="al-loading-orb" />
                <p>Fetching latest news...</p>
              </div>
            ) : newsError ? (
              <div className="al-news__articles-error">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <p>{newsError}</p>
              </div>
            ) : articles.length === 0 ? (
              <div className="al-news__articles-empty">
                <p>No news articles found at this time. Check back later.</p>
              </div>
            ) : (
              <div className="al-news__articles-grid">
                {articles.map((article, idx) => (
                  <article
                    key={idx}
                    className="al-news__article-card"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <div className="al-news__article-img-wrap">
                      <img
                        src={article.urlToImage}
                        alt=""
                        className="al-news__article-img"
                        loading="lazy"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    </div>
                    <div className="al-news__article-body">
                      <div className="al-news__article-meta">
                        <span className="al-news__article-source">
                          {article.source?.name || "Unknown"}
                        </span>
                        <span className="al-news__article-time">
                          {dayjs(article.publishedAt).fromNow()}
                        </span>
                      </div>
                      <h3 className="al-news__article-title">{article.title}</h3>
                      <p className="al-news__article-desc">
                        {truncate(article.description, 140)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Article Detail Modal */}
          {selectedArticle && (
            <div className="al-news__modal-overlay" onClick={() => setSelectedArticle(null)}>
              <div className="al-news__modal" onClick={(e) => e.stopPropagation()}>
                <button className="al-news__modal-close" onClick={() => setSelectedArticle(null)}>
                  ✕
                </button>
                {selectedArticle.urlToImage && (
                  <img
                    src={selectedArticle.urlToImage}
                    alt=""
                    className="al-news__modal-img"
                  />
                )}
                <div className="al-news__modal-body">
                  <div className="al-news__modal-meta">
                    <span className="al-news__article-source">
                      {selectedArticle.source?.name}
                    </span>
                    {selectedArticle.author && (
                      <span className="al-news__modal-author">
                        by {selectedArticle.author}
                      </span>
                    )}
                    <span className="al-news__article-time">
                      {dayjs(selectedArticle.publishedAt).format("DD MMM YYYY, h:mm A")}
                    </span>
                  </div>
                  <h2 className="al-news__modal-title">{selectedArticle.title}</h2>
                  <p className="al-news__modal-desc">{selectedArticle.description}</p>
                  {selectedArticle.content && (
                    <p className="al-news__modal-content">
                      {selectedArticle.content.replace(/\[\+\d+ chars\]$/, "...")}
                    </p>
                  )}
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="al-news__modal-link"
                  >
                    Read full article
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
