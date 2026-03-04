import { useEffect, useMemo, useState, useCallback } from "react";
import Chart from "react-apexcharts";
import dayjs from "dayjs";
import { PROD_API_URL, metalLabelMap, metalThemes } from "../utils/constants";
import { formatMoney, getMetalTheme } from "../utils/helpers";
import { cachedFetch } from "../lib/apiCache";
import { useTheme } from "../contexts/ThemeContext";

const COMPARE_METALS = ["XAU", "XAG", "XPT", "XPD", "XCU", "NI", "ZNC", "ALU", "LEAD"];

const TIMEFRAMES = [
  { key: "weekly", label: "7 Days" },
  { key: "monthly", label: "30 Days" },
];

// ─── Stat helpers ──────────────────────────────────────────────

const pctChange = (curr, prev) => {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
};

const calcVolatility = (prices) => {
  if (!prices || prices.length < 2) return null;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  if (!returns.length) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * 100;
};

const calcSMA = (prices, period) => {
  if (!prices || prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
};

const calcRange = (prices) => {
  if (!prices || !prices.length) return { high: 0, low: 0, range: 0 };
  const valid = prices.filter(Number.isFinite);
  if (!valid.length) return { high: 0, low: 0, range: 0 };
  const high = Math.max(...valid);
  const low = Math.min(...valid);
  return { high, low, range: high - low };
};

const calcAvg = (prices) => {
  if (!prices || !prices.length) return 0;
  const valid = prices.filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
};

const normalizeToPercent = (prices) => {
  if (!prices || !prices.length) return [];
  const base = prices.find(Number.isFinite);
  if (!base || base === 0) return prices.map(() => 0);
  return prices.map((p) => (Number.isFinite(p) ? ((p - base) / base) * 100 : null));
};

// ────────────────────────────────────────────────────────────────

export default function Compare() {
  const [metalA, setMetalA] = useState("XAU");
  const [metalB, setMetalB] = useState("XAG");
  const [timeframe, setTimeframe] = useState("weekly");
  const [chartMode, setChartMode] = useState("absolute");
  const [unit, setUnit] = useState("1g");

  const [latestA, setLatestA] = useState(null);
  const [latestB, setLatestB] = useState(null);
  const [compA, setCompA] = useState(null);
  const [compB, setCompB] = useState(null);
  const [historyA, setHistoryA] = useState([]);
  const [historyB, setHistoryB] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMetal = useCallback(async (metal, tf) => {
    try {
      const endpoint = tf === "monthly" ? "monthly-history" : "weekly-history";
      const [latest, comparison, history] = await Promise.all([
        cachedFetch(`${PROD_API_URL}/get-latest-price?metal=${metal}`),
        cachedFetch(`${PROD_API_URL}/compare-yesterday?metal=${metal}`),
        cachedFetch(`${PROD_API_URL}/${endpoint}?metal=${metal}`),
      ]);
      return {
        latest: latest?.latest || null,
        comparison: comparison?.comparison || null,
        history: history?.history || [],
      };
    } catch {
      return { latest: null, comparison: null, history: [] };
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMetal(metalA, timeframe), fetchMetal(metalB, timeframe)]).then(([a, b]) => {
      setLatestA(a.latest);
      setLatestB(b.latest);
      setCompA(a.comparison);
      setCompB(b.comparison);
      setHistoryA(a.history);
      setHistoryB(b.history);
      setLoading(false);
    });
  }, [metalA, metalB, timeframe, fetchMetal]);

  // ─── Derived analytics ─────────────────────────────────────────

  const priceKeyForUnit = unit === "1kg" ? "price_per_kg" : unit === "8g" ? "price_8g" : "price_1g";

  const pricesArrayA = useMemo(() => historyA.map((p) => p[priceKeyForUnit] ?? p.price_1g), [historyA, priceKeyForUnit]);
  const pricesArrayB = useMemo(() => historyB.map((p) => p[priceKeyForUnit] ?? p.price_1g), [historyB, priceKeyForUnit]);

  const statsA = useMemo(() => {
    const range = calcRange(pricesArrayA);
    const today = compA?.today_prices?.[priceKeyForUnit] || latestA?.[priceKeyForUnit] || 0;
    const yesterday = compA?.yesterday_prices?.[priceKeyForUnit] || 0;
    return {
      current: today,
      dayChange: today - yesterday,
      dayChangePct: pctChange(today, yesterday),
      high: range.high,
      low: range.low,
      range: range.range,
      average: calcAvg(pricesArrayA),
      volatility: calcVolatility(pricesArrayA),
      sma3: calcSMA(pricesArrayA, 3),
      sma7: calcSMA(pricesArrayA, 7),
    };
  }, [pricesArrayA, compA, latestA, priceKeyForUnit]);

  const statsB = useMemo(() => {
    const range = calcRange(pricesArrayB);
    const today = compB?.today_prices?.[priceKeyForUnit] || latestB?.[priceKeyForUnit] || 0;
    const yesterday = compB?.yesterday_prices?.[priceKeyForUnit] || 0;
    return {
      current: today,
      dayChange: today - yesterday,
      dayChangePct: pctChange(today, yesterday),
      high: range.high,
      low: range.low,
      range: range.range,
      average: calcAvg(pricesArrayB),
      volatility: calcVolatility(pricesArrayB),
      sma3: calcSMA(pricesArrayB, 3),
      sma7: calcSMA(pricesArrayB, 7),
    };
  }, [pricesArrayB, compB, latestB, priceKeyForUnit]);

  const correlation = useMemo(() => {
    if (pricesArrayA.length < 3 || pricesArrayB.length < 3) return null;
    const allDates = [...new Set([...historyA, ...historyB].map((p) => p.date))].sort();
    const mapA = {};
    const mapB = {};
    historyA.forEach((p) => (mapA[p.date] = p[priceKeyForUnit] ?? p.price_1g));
    historyB.forEach((p) => (mapB[p.date] = p[priceKeyForUnit] ?? p.price_1g));
    const pairs = allDates.filter((d) => mapA[d] != null && mapB[d] != null).map((d) => [mapA[d], mapB[d]]);
    if (pairs.length < 3) return null;

    const n = pairs.length;
    const meanA = pairs.reduce((s, p) => s + p[0], 0) / n;
    const meanB = pairs.reduce((s, p) => s + p[1], 0) / n;
    let num = 0, denA = 0, denB = 0;
    for (const [a, b] of pairs) {
      num += (a - meanA) * (b - meanB);
      denA += (a - meanA) ** 2;
      denB += (b - meanB) ** 2;
    }
    const den = Math.sqrt(denA) * Math.sqrt(denB);
    return den === 0 ? 0 : num / den;
  }, [historyA, historyB, pricesArrayA, pricesArrayB, priceKeyForUnit]);

  const priceRatio = useMemo(() => {
    if (!statsA.current || !statsB.current || statsB.current === 0) return null;
    return statsA.current / statsB.current;
  }, [statsA.current, statsB.current]);

  // ─── Chart data ────────────────────────────────────────────────

  const { darkMode } = useTheme();
  const themeA = getMetalTheme(metalA);
  const themeB = getMetalTheme(metalB);

  const chartLabels = useMemo(() => {
    const allDates = [...new Set([...historyA, ...historyB].map((p) => p.date))].sort();
    return allDates.map((d) => dayjs(d).format("DD MMM"));
  }, [historyA, historyB]);

  const chartDatesAll = useMemo(() =>
    [...new Set([...historyA, ...historyB].map((p) => p.date))].sort()
  , [historyA, historyB]);

  const mapDataRaw = useCallback((history, dates) => {
    const byDate = {};
    history.forEach((p) => (byDate[p.date] = p[priceKeyForUnit] ?? p.price_1g));
    return dates.map((d) => byDate[d] ?? null);
  }, [priceKeyForUnit]);

  const lineSeriesA = useMemo(() => mapDataRaw(historyA, chartDatesAll), [historyA, chartDatesAll, mapDataRaw]);
  const lineSeriesB = useMemo(() => mapDataRaw(historyB, chartDatesAll), [historyB, chartDatesAll, mapDataRaw]);

  const apexLineSeries = useMemo(() => {
    let dataA = lineSeriesA;
    let dataB = lineSeriesB;
    if (chartMode === "normalized") {
      dataA = normalizeToPercent(dataA);
      dataB = normalizeToPercent(dataB);
    }
    return [
      { name: metalLabelMap[metalA] || metalA, data: dataA },
      { name: metalLabelMap[metalB] || metalB, data: dataB },
    ];
  }, [lineSeriesA, lineSeriesB, chartMode, metalA, metalB]);

  const apexLineOptions = useMemo(() => {
    const allVals = [...(chartMode === "normalized" ? normalizeToPercent(lineSeriesA) : lineSeriesA), ...(chartMode === "normalized" ? normalizeToPercent(lineSeriesB) : lineSeriesB)].filter(Number.isFinite);
    const mn = allVals.length ? Math.min(...allVals) : 0;
    const mx = allVals.length ? Math.max(...allVals) : 1;
    const pad = Math.max((mx - mn) * 0.12, 1);
    return {
      chart: { type: "area", height: 340, toolbar: { show: false }, fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif', zoom: { enabled: false }, animations: { enabled: true, easing: "easeinout", speed: 600 } },
      colors: [themeA.primary, themeB.primary],
      fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] } },
      stroke: { curve: "smooth", width: 3 },
      markers: { size: 4, strokeColors: darkMode ? "#1c1a24" : "#ffffff", strokeWidth: 2 },
      xaxis: { categories: chartLabels, labels: { style: { colors: darkMode ? "#a9adb8" : "#5d6b7a", fontSize: "11px" } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: {
        min: chartMode === "normalized" ? undefined : Math.max(0, mn - pad),
        max: chartMode === "normalized" ? undefined : mx + pad,
        labels: { formatter: (v) => chartMode === "normalized" ? `${v?.toFixed(1)}%` : formatMoney(v), style: { colors: darkMode ? "#a9adb8" : "#5d6b7a", fontSize: "11px" } },
      },
      grid: { borderColor: darkMode ? "#2e2b38" : "rgba(200,200,200,0.2)", strokeDashArray: 4 },
      tooltip: { theme: darkMode ? "dark" : "light", y: { formatter: (v) => chartMode === "normalized" ? `${v?.toFixed(2)}%` : formatMoney(v) } },
      legend: { position: "top", labels: { colors: darkMode ? "#e0dcd4" : "#333" } },
      dataLabels: { enabled: false },
    };
  }, [chartLabels, darkMode, themeA, themeB, lineSeriesA, lineSeriesB, chartMode]);

  const apexBarSeries = useMemo(() => [
    { name: metalLabelMap[metalA] || metalA, data: [statsA.current, statsA.high, statsA.low, statsA.average] },
    { name: metalLabelMap[metalB] || metalB, data: [statsB.current, statsB.high, statsB.low, statsB.average] },
  ], [statsA, statsB, metalA, metalB]);

  const apexBarOptions = useMemo(() => ({
    chart: { type: "bar", height: 340, toolbar: { show: false }, fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif' },
    colors: [themeA.primary, themeB.primary],
    plotOptions: { bar: { borderRadius: 6, columnWidth: "55%", dataLabels: { position: "top" } } },
    xaxis: { categories: ["Current Price", "Period High", "Period Low", "Period Average"], labels: { style: { colors: darkMode ? "#a9adb8" : "#5d6b7a", fontSize: "11px" } } },
    yaxis: { labels: { formatter: (v) => formatMoney(v), style: { colors: darkMode ? "#a9adb8" : "#5d6b7a", fontSize: "11px" } } },
    grid: { borderColor: darkMode ? "#2e2b38" : "rgba(200,200,200,0.2)", strokeDashArray: 4 },
    tooltip: { theme: darkMode ? "dark" : "light", y: { formatter: (v) => formatMoney(v) } },
    legend: { position: "top", labels: { colors: darkMode ? "#e0dcd4" : "#333" } },
    dataLabels: { enabled: false },
  }), [themeA, themeB, darkMode]);

  // ─── Render helpers ────────────────────────────────────────────

  const fmtPct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
  const fmtPrice = (v) => (v ? formatMoney(v) : "—");
  const changeClass = (v) => (v == null ? "" : v >= 0 ? "al-compare__positive" : "al-compare__negative");

  const unitLabel = unit === "1kg" ? "/kg" : unit === "8g" ? "/8g" : "/g";

  const renderMetricRow = (label, valA, valB, formatter = fmtPrice, colorize = false) => (
    <tr key={label}>
      <td className="al-compare__metric-label">{label}</td>
      <td className={colorize ? changeClass(valA) : ""}>{formatter(valA)}</td>
      <td className={colorize ? changeClass(valB) : ""}>{formatter(valB)}</td>
    </tr>
  );

  const renderWinner = (label, valA, valB, higherBetter = true) => {
    if (valA == null || valB == null) return null;
    const aWins = higherBetter ? valA > valB : valA < valB;
    const winner = aWins ? metalLabelMap[metalA] : metalLabelMap[metalB];
    const theme = aWins ? themeA : themeB;
    return (
      <div className="al-compare__verdict-item" key={label}>
        <span className="al-compare__verdict-label">{label}</span>
        <span className="al-compare__verdict-winner" style={{ color: theme.primary }}>{winner}</span>
      </div>
    );
  };

  return (
    <div className="al-page al-compare-page">
      <div className="al-page__header">
        <h1 className="al-page__title">Metal Comparison</h1>
        <p className="al-page__subtitle">Advanced side-by-side analysis with volatility, correlation &amp; trend metrics</p>
      </div>

      {/* ─── Controls row ──────────────────────────────────────── */}
      <div className="al-compare__controls">
        <div className="al-compare__selectors">
          <div className="al-compare__selector">
            <label htmlFor="compare-metal-a">Metal A</label>
            <select id="compare-metal-a" value={metalA} onChange={(e) => setMetalA(e.target.value)} className="al-select">
              {COMPARE_METALS.map((m) => (
                <option key={m} value={m} disabled={m === metalB}>{metalLabelMap[m] || m}</option>
              ))}
            </select>
          </div>
          <div className="al-compare__vs">vs</div>
          <div className="al-compare__selector">
            <label htmlFor="compare-metal-b">Metal B</label>
            <select id="compare-metal-b" value={metalB} onChange={(e) => setMetalB(e.target.value)} className="al-select">
              {COMPARE_METALS.map((m) => (
                <option key={m} value={m} disabled={m === metalA}>{metalLabelMap[m] || m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="al-compare__filters">
          <div className="al-compare__filter-group">
            <label>Timeframe</label>
            <div className="al-compare__toggle-group">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.key}
                  className={`al-compare__toggle-btn ${timeframe === tf.key ? "active" : ""}`}
                  onClick={() => setTimeframe(tf.key)}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
          <div className="al-compare__filter-group">
            <label>Unit</label>
            <div className="al-compare__toggle-group">
              {[
                { key: "1g", label: "Per Gram" },
                { key: "8g", label: "Per 8g" },
                { key: "1kg", label: "Per Kg" },
              ].map((u) => (
                <button
                  key={u.key}
                  className={`al-compare__toggle-btn ${unit === u.key ? "active" : ""}`}
                  onClick={() => setUnit(u.key)}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="al-loading-container">
          <div className="al-loading-orb" />
          <p>Loading comparison data...</p>
        </div>
      ) : (
        <>
          {/* ─── Price Summary Cards ───────────────────────────── */}
          <div className="al-compare__cards">
            {[
              { metal: metalA, stats: statsA, latest: latestA, theme: themeA },
              { metal: metalB, stats: statsB, latest: latestB, theme: themeB },
            ].map(({ metal, stats, latest, theme }) => (
              <div className="al-compare__card" key={metal}>
                <div className="al-compare__card-header">
                  <h3 className="al-compare__card-title" style={{ color: theme.primary }}>
                    {metalLabelMap[metal]}
                  </h3>
                  {stats.dayChangePct != null && (
                    <span className={`al-compare__badge ${stats.dayChangePct >= 0 ? "up" : "down"}`}>
                      {stats.dayChangePct >= 0 ? "▲" : "▼"} {Math.abs(stats.dayChangePct).toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="al-compare__card-price">
                  {fmtPrice(stats.current)}
                  <span className="al-compare__card-unit">{unitLabel}</span>
                </div>
                <div className="al-compare__card-meta">
                  <div className="al-compare__card-meta-item">
                    <span>Day Change</span>
                    <span className={changeClass(stats.dayChange)}>
                      {stats.dayChange >= 0 ? "+" : ""}{fmtPrice(Math.abs(stats.dayChange))}
                    </span>
                  </div>
                  <div className="al-compare__card-meta-item">
                    <span>Period High</span>
                    <span>{fmtPrice(stats.high)}</span>
                  </div>
                  <div className="al-compare__card-meta-item">
                    <span>Period Low</span>
                    <span>{fmtPrice(stats.low)}</span>
                  </div>
                </div>
                {latest?.date && (
                  <span className="al-compare__card-date">
                    Updated {dayjs(latest.date).format("DD MMM YYYY")}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* ─── Correlation & Ratio Banner ────────────────────── */}
          <div className="al-compare__insights">
            <div className="al-compare__insight-card">
              <span className="al-compare__insight-label">Price Correlation</span>
              <span className="al-compare__insight-val">
                {correlation != null ? correlation.toFixed(3) : "—"}
              </span>
              <span className="al-compare__insight-desc">
                {correlation != null
                  ? correlation > 0.7
                    ? "Strong positive"
                    : correlation > 0.3
                    ? "Moderate positive"
                    : correlation > -0.3
                    ? "Weak / no correlation"
                    : correlation > -0.7
                    ? "Moderate negative"
                    : "Strong negative"
                  : "Insufficient data"}
              </span>
            </div>
            <div className="al-compare__insight-card">
              <span className="al-compare__insight-label">Price Ratio (A:B)</span>
              <span className="al-compare__insight-val">
                {priceRatio != null ? `${priceRatio.toFixed(2)}x` : "—"}
              </span>
              <span className="al-compare__insight-desc">
                {priceRatio != null
                  ? `1g ${metalLabelMap[metalB]} = ${formatMoney(statsB.current)} vs ${formatMoney(statsA.current)}`
                  : "No data"}
              </span>
            </div>
            <div className="al-compare__insight-card">
              <span className="al-compare__insight-label">Volatility (A)</span>
              <span className="al-compare__insight-val">
                {statsA.volatility != null ? `${statsA.volatility.toFixed(3)}%` : "—"}
              </span>
              <span className="al-compare__insight-desc">Daily price fluctuation</span>
            </div>
            <div className="al-compare__insight-card">
              <span className="al-compare__insight-label">Volatility (B)</span>
              <span className="al-compare__insight-val">
                {statsB.volatility != null ? `${statsB.volatility.toFixed(3)}%` : "—"}
              </span>
              <span className="al-compare__insight-desc">Daily price fluctuation</span>
            </div>
          </div>

          {/* ─── Chart Section ─────────────────────────────────── */}
          <div className="al-compare__chart-wrapper">
            <div className="al-compare__chart-header">
              <h3 className="al-compare__chart-title">
                {chartMode === "bar"
                  ? "Metric Comparison"
                  : chartMode === "normalized"
                  ? "Normalized % Change"
                  : `Price Trend (${timeframe === "monthly" ? "30 Days" : "7 Days"})`}
              </h3>
              <div className="al-compare__chart-modes">
                {[
                  { key: "absolute", label: "Absolute" },
                  { key: "normalized", label: "% Change" },
                  { key: "bar", label: "Bar" },
                ].map((m) => (
                  <button
                    key={m.key}
                    className={`al-compare__toggle-btn sm ${chartMode === m.key ? "active" : ""}`}
                    onClick={() => setChartMode(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="al-compare__chart">
              {chartMode === "bar" ? (
                <Chart options={apexBarOptions} series={apexBarSeries} type="bar" height={340} />
              ) : (
                <Chart options={apexLineOptions} series={apexLineSeries} type="area" height={340} />
              )}
            </div>
          </div>

          {/* ─── Detailed Stats Table ──────────────────────────── */}
          <div className="al-compare__table-wrapper">
            <h3 className="al-compare__section-title">Detailed Comparison</h3>
            <div className="al-compare__table-scroll">
              <table className="al-compare__table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style={{ color: themeA.primary }}>{metalLabelMap[metalA]}</th>
                    <th style={{ color: themeB.primary }}>{metalLabelMap[metalB]}</th>
                  </tr>
                </thead>
                <tbody>
                  {renderMetricRow(`Current Price ${unitLabel}`, statsA.current, statsB.current)}
                  {renderMetricRow("Day Change", statsA.dayChange, statsB.dayChange, (v) => `${v >= 0 ? "+" : ""}${fmtPrice(Math.abs(v))}`, true)}
                  {renderMetricRow("Day Change %", statsA.dayChangePct, statsB.dayChangePct, fmtPct, true)}
                  {renderMetricRow("Period High", statsA.high, statsB.high)}
                  {renderMetricRow("Period Low", statsA.low, statsB.low)}
                  {renderMetricRow("Price Range", statsA.range, statsB.range)}
                  {renderMetricRow("Period Average", statsA.average, statsB.average)}
                  {renderMetricRow("Volatility", statsA.volatility, statsB.volatility, (v) => v != null ? `${v.toFixed(3)}%` : "—")}
                  {renderMetricRow("3-Day SMA", statsA.sma3, statsB.sma3)}
                  {timeframe === "monthly" && renderMetricRow("7-Day SMA", statsA.sma7, statsB.sma7)}
                  <tr>
                    <td className="al-compare__metric-label">Correlation</td>
                    <td colSpan="2" style={{ textAlign: "center" }}>
                      {correlation != null ? correlation.toFixed(4) : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="al-compare__metric-label">Price Ratio (A÷B)</td>
                    <td colSpan="2" style={{ textAlign: "center" }}>
                      {priceRatio != null ? `${priceRatio.toFixed(4)}x` : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Quick Verdicts ─────────────────────────────────── */}
          <div className="al-compare__verdicts">
            <h3 className="al-compare__section-title">Quick Verdicts</h3>
            <div className="al-compare__verdict-grid">
              {renderWinner("Higher Price", statsA.current, statsB.current, true)}
              {renderWinner("Bigger Day Gain", statsA.dayChangePct, statsB.dayChangePct, true)}
              {renderWinner("Lower Volatility (Safer)", statsA.volatility, statsB.volatility, false)}
              {renderWinner("Higher Period High", statsA.high, statsB.high, true)}
              {renderWinner("Tighter Spread", statsA.range, statsB.range, false)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
