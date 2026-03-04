import { useMemo } from "react";
import { formatMetalLabel, getMetalTheme, sortMetals } from "../../utils/helpers";
import { metalLabelMap } from "../../utils/constants";

/**
 * MarketTicker — continuous horizontal scrolling ticker showing all metal comparisons.
 * Data source: pre-fetched comparisons object from /compare-yesterday for each metal.
 */
export default function MarketTicker({ metals, comparisons }) {
  const tickerItems = useMemo(() => {
    if (!metals?.length) return [];

    return sortMetals(metals.filter(m => !["BTC", "ETH", "HG"].includes(m.metal_name)))
      .map((metal) => {
        const comp = comparisons[metal.metal_name];
        const theme = getMetalTheme(metal.metal_name);
        const isGoldMetal = metal.metal_name === "XAU";
        const caratLabel = isGoldMetal ? " 22K" : "";

        let direction = "neutral";
        let change = "0.00";
        let pct = "0.00";

        if (comp) {
          const today = comp.today_prices?.price_1g;
          const yesterday = comp.yesterday_prices?.price_1g;

          if (Number.isFinite(today) && Number.isFinite(yesterday) && yesterday !== 0) {
            const diff = today - yesterday;
            const pctVal = (diff / yesterday) * 100;
            direction = diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
            change = Math.abs(diff).toFixed(2);
            pct = Math.abs(pctVal).toFixed(2);
          }
        }

        const name = metalLabelMap[metal.metal_name] || formatMetalLabel(metal);
        const arrow = direction === "up" ? "+" : direction === "down" ? "-" : "";

        return { key: metal.metal_name, name, caratLabel, direction, change, pct, arrow, theme };
      });
  }, [metals, comparisons]);

  if (!tickerItems.length) return null;

  // Duplicate items for seamless infinite scroll
  const doubled = [...tickerItems, ...tickerItems];

  return (
    <div className="al-market-ticker" role="marquee" aria-label="Live metal price ticker">
      <span className="al-market-ticker-label">LIVE</span>
      <div className="al-market-ticker-track">
        <div className="al-market-ticker-content">
          {doubled.map((item, i) => (
            <span key={`${item.key}-${i}`} className="al-market-ticker-item">
              <span className="ticker-name">{item.name}</span>
              {item.caratLabel && <span className="ticker-purity">{item.caratLabel}</span>}
              <span className={`ticker-change ${item.direction}`}>
                {item.arrow}{item.change} ({item.pct}%)
              </span>
              <span className="ticker-sep" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
