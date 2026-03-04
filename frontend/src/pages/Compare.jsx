import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import dayjs from "dayjs";
import { PROD_API_URL, metalLabelMap, metalThemes } from "../utils/constants";
import { formatMoney, sortMetals, getMetalTheme } from "../utils/helpers";
import { cachedFetch } from "../lib/apiCache";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const COMPARE_METALS = ["XAU", "XAG", "XPT", "XPD", "XCU", "NI", "ZNC", "ALU", "LEAD"];

export default function Compare() {
  const [metalA, setMetalA] = useState("XAU");
  const [metalB, setMetalB] = useState("XAG");
  const [pricesA, setPricesA] = useState(null);
  const [pricesB, setPricesB] = useState(null);
  const [weeklyA, setWeeklyA] = useState([]);
  const [weeklyB, setWeeklyB] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMetal = async (metal) => {
    try {
      const [latest, weekly] = await Promise.all([
        cachedFetch(`${PROD_API_URL}/get-latest-price?metal=${metal}`),
        cachedFetch(`${PROD_API_URL}/weekly-history?metal=${metal}`),
      ]);
      return {
        latest: latest?.latest || null,
        weekly: weekly?.history || [],
      };
    } catch {
      return { latest: null, weekly: [] };
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMetal(metalA), fetchMetal(metalB)]).then(([a, b]) => {
      setPricesA(a.latest);
      setPricesB(b.latest);
      setWeeklyA(a.weekly);
      setWeeklyB(b.weekly);
      setLoading(false);
    });
  }, [metalA, metalB]);

  const chartData = useMemo(() => {
    const allDates = [...new Set([...weeklyA, ...weeklyB].map((p) => p.date))].sort();
    const labels = allDates.map((d) => dayjs(d).format("DD MMM"));
    const themeA = getMetalTheme(metalA);
    const themeB = getMetalTheme(metalB);

    const mapData = (weekly) => {
      const byDate = {};
      weekly.forEach((p) => (byDate[p.date] = p.price_1g));
      return allDates.map((d) => byDate[d] ?? null);
    };

    return {
      labels,
      datasets: [
        {
          label: metalLabelMap[metalA] || metalA,
          data: mapData(weeklyA),
          borderColor: themeA.primary,
          backgroundColor: themeA.light,
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          borderWidth: 2,
        },
        {
          label: metalLabelMap[metalB] || metalB,
          data: mapData(weeklyB),
          borderColor: themeB.primary,
          backgroundColor: themeB.light,
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          borderWidth: 2,
        },
      ],
    };
  }, [weeklyA, weeklyB, metalA, metalB]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: true, position: "top", labels: { usePointStyle: true, padding: 16 } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "var(--muted)" } },
      y: { grid: { color: "rgba(200,200,200,0.12)" }, ticks: { color: "var(--muted)" } },
    },
  };

  const renderStat = (label, latest) => {
    if (!latest) return <span className="al-compare__stat-val">—</span>;
    return (
      <div className="al-compare__stat-block">
        <span className="al-compare__stat-val">{formatMoney(latest.price_1g || 0)}</span>
        <span className="al-compare__stat-unit">/gram</span>
      </div>
    );
  };

  return (
    <div className="al-page al-compare-page">
      <div className="al-page__header">
        <h1 className="al-page__title">Metal Comparison</h1>
        <p className="al-page__subtitle">Compare price movements side-by-side</p>
      </div>

      {/* Selectors */}
      <div className="al-compare__selectors">
        <div className="al-compare__selector">
          <label htmlFor="compare-metal-a">Metal A</label>
          <select id="compare-metal-a" value={metalA} onChange={(e) => setMetalA(e.target.value)} className="al-select">
            {COMPARE_METALS.map((m) => (
              <option key={m} value={m} disabled={m === metalB}>
                {metalLabelMap[m] || m}
              </option>
            ))}
          </select>
        </div>
        <div className="al-compare__vs">vs</div>
        <div className="al-compare__selector">
          <label htmlFor="compare-metal-b">Metal B</label>
          <select id="compare-metal-b" value={metalB} onChange={(e) => setMetalB(e.target.value)} className="al-select">
            {COMPARE_METALS.map((m) => (
              <option key={m} value={m} disabled={m === metalA}>
                {metalLabelMap[m] || m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="al-loading-container">
          <div className="al-loading-orb" />
          <p>Loading comparison...</p>
        </div>
      ) : (
        <>
          {/* Price Cards */}
          <div className="al-compare__cards">
            <div className="al-compare__card">
              <h3 className="al-compare__card-title" style={{ color: getMetalTheme(metalA).primary }}>
                {metalLabelMap[metalA]}
              </h3>
              {renderStat(metalA, pricesA)}
              {pricesA?.date && (
                <span className="al-compare__card-date">
                  {dayjs(pricesA.date).format("DD MMM YYYY")}
                </span>
              )}
            </div>
            <div className="al-compare__card">
              <h3 className="al-compare__card-title" style={{ color: getMetalTheme(metalB).primary }}>
                {metalLabelMap[metalB]}
              </h3>
              {renderStat(metalB, pricesB)}
              {pricesB?.date && (
                <span className="al-compare__card-date">
                  {dayjs(pricesB.date).format("DD MMM YYYY")}
                </span>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="al-compare__chart-wrapper">
            <h3 className="al-compare__chart-title">7-Day Price Trend</h3>
            <div className="al-compare__chart">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
