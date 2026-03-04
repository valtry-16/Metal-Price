/**
 * MarketInsight — AI-generated daily market summary display.
 * Works on both desktop and mobile (no longer hidden on mobile).
 */
export default function MarketInsight({ dailySummary, summaryLoading, summaryGenerating }) {
  const hasContent = dailySummary || summaryLoading || summaryGenerating;
  if (!hasContent) return null;

  const renderSummaryText = (text) => {
    return text.split("\n").map((line, i) => {
      if (!line.trim()) return <div key={i} className="summary-spacer" />;

      // Convert ## headings
      const headingMatch = line.match(/^#{1,3}\s+(.*)/);
      if (headingMatch) {
        const hParts = headingMatch[1].split(/(\*\*[^*]+\*\*)/).map((seg, j) => {
          if (seg.startsWith("**") && seg.endsWith("**")) return <strong key={j}>{seg.slice(2, -2)}</strong>;
          return seg;
        });
        return <p key={i} className="summary-heading">{hParts}</p>;
      }

      // Bold text conversion
      const parts = line.split(/(\*\*[^*]+\*\*)/).map((seg, j) => {
        if (seg.startsWith("**") && seg.endsWith("**")) {
          return <strong key={j}>{seg.slice(2, -2)}</strong>;
        }
        return seg;
      });

      const isMetalLine = line.includes("\u20B9") && (/\/g|\/kg|per gram|per kg|per 8g/i.test(line));

      return (
        <p key={i} className={isMetalLine ? "summary-metal" : ""}>
          {parts}
        </p>
      );
    });
  };

  return (
    <div className="al-market-insight">
      <div className="al-market-insight-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 className="al-market-insight-title">Daily Market Summary</h2>
          <span className="al-market-insight-badge">AI Generated</span>
        </div>
        <div>
          {dailySummary && !summaryGenerating && (
            <span className="al-market-insight-date">{dailySummary.date}</span>
          )}
          {summaryGenerating && (
            <span className="al-market-insight-loading">Generating...</span>
          )}
          {summaryLoading && !summaryGenerating && (
            <span className="al-market-insight-loading">Updating...</span>
          )}
        </div>
      </div>

      {summaryGenerating ? (
        <div className="al-market-insight-generating">
          <div className="al-market-insight-orb" />
          <p className="al-market-insight-gen-text">Generating Today's Summary</p>
          <p className="al-market-insight-gen-sub">Please wait...</p>
        </div>
      ) : summaryLoading ? (
        <div className="al-market-skeleton">
          <div className="al-market-skeleton-line w80" />
          <div className="al-market-skeleton-line w60" />
          <div className="al-market-skeleton-line w90" />
          <div className="al-market-skeleton-line w70" />
          <div className="al-market-skeleton-line w80" />
          <div className="al-market-skeleton-line w50" />
        </div>
      ) : dailySummary ? (
        <div className="al-market-insight-body">
          {renderSummaryText(dailySummary.summary)}
        </div>
      ) : null}
    </div>
  );
}
