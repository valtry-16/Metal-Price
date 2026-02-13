import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value ?? 0);

const unitsForMetal = (metal) => {
  if (!metal) return [];
  const name = metal.toLowerCase();
  if (name.includes("gold") || name.includes("xau")) {
    return [
      { label: "1 gram", value: "1g" },
      { label: "8 grams", value: "8g" }
    ];
  }
  return [
    { label: "1 gram", value: "1g" },
    { label: "1 kilogram", value: "1kg" }
  ];
};

const goldCarats = [
  { label: "18 Carat", value: "18", purity: 0.75 },
  { label: "22 Carat (Primary)", value: "22", purity: 0.916, highlight: true },
  { label: "24 Carat", value: "24", purity: 1 }
];

const metalLabelMap = {
  XAU: "Gold",
  XAG: "Silver",
  XPT: "Platinum",
  XPD: "Palladium",
  HG: "Copper"
};

const metalThemes = {
  XAU: { primary: "#B8860B", secondary: "#FFD700", light: "rgba(184, 134, 11, 0.12)", name: "Gold" },
  XAG: { primary: "#6B7280", secondary: "#A0AEC0", light: "rgba(107, 114, 128, 0.12)", name: "Silver" },
  XPT: { primary: "#5B5B5B", secondary: "#8B8B8B", light: "rgba(91, 91, 91, 0.12)", name: "Platinum" },
  XPD: { primary: "#7B8B7A", secondary: "#A8B8A7", light: "rgba(123, 139, 122, 0.12)", name: "Palladium" },
  HG: { primary: "#B87333", secondary: "#E89B6B", light: "rgba(184, 115, 51, 0.12)", name: "Copper" }
};

const getMetalTheme = (metal) => {
  const symbol = metal.toLowerCase();
  for (const [key, theme] of Object.entries(metalThemes)) {
    if (symbol.includes(key.toLowerCase())) return theme;
  }
  return metalThemes.XAU;
};

const calculateChartRange = (allValues) => {
  const nums = allValues.filter((v) => Number.isFinite(v));
  if (!nums.length) return { min: 0, max: 100 };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;
  const padding = Math.max(range * 0.15, 1);
  return { min: Math.max(0, min - padding), max: max + padding };
};

const formatMetalLabel = (metal) => {
  if (!metal) return "";
  const symbol = metal.metal_name || "";
  const name = metal.display_name || metalLabelMap[symbol] || "";
  return name || symbol;
};

const buildChartData = (points, series) => {
  const labels = points.map((point) => dayjs(point.date).format("DD MMM"));
  const datasets = series
    .map((item) => {
      const values = points.map((point) => {
        if (item.getValue) return item.getValue(point);
        return point[item.key] ?? null;
      });
      const hasValue = values.some((value) => Number.isFinite(value));
      if (!hasValue) return null;
      return {
        label: item.label,
        data: values,
        tension: 0.3,
        fill: true,
        borderColor: item.color,
        backgroundColor: item.fillColor,
        pointRadius: 4,
        borderWidth: 3,
        pointBackgroundColor: item.color,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2
      };
    })
    .filter(Boolean);

  return { labels, datasets };
};

const buildChartOptions = (range) => ({
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { 
      display: false
    }
  },
  scales: {
    x: { 
      grid: { display: false },
      ticks: { color: "#5d6b7a" }
    },
    y: {
      grid: { color: "rgba(93, 107, 122, 0.15)" },
      ticks: { color: "#5d6b7a" },
      min: range.min,
      max: range.max
    }
  }
});

export default function App() {
  const [metals, setMetals] = useState([]);
  const [selectedMetal, setSelectedMetal] = useState("");
  const [carat, setCarat] = useState("22");
  const [unit, setUnit] = useState("1g");
  const [latest, setLatest] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [status, setStatus] = useState({ loading: true, error: "" });

  const isGold = useMemo(() => {
    return selectedMetal.toLowerCase().includes("gold") || selectedMetal.toLowerCase().includes("xau");
  }, [selectedMetal]);

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: "" });
        const response = await fetch(`${API_BASE}/get-latest-price`);
        if (!response.ok) throw new Error("Unable to fetch latest prices");
        const data = await response.json();
        const filteredMetals = (data.metals || []).filter(m => !['BTC', 'ETH'].includes(m.metal_name));
        setMetals(filteredMetals);
        if (filteredMetals?.length) {
          setSelectedMetal((prev) => prev || filteredMetals[0].metal_name);
        }
      } catch (error) {
        setStatus({ loading: false, error: error.message });
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedMetal) return;
    const loadDetails = async () => {
      try {
        setStatus((prev) => ({ ...prev, loading: true, error: "" }));
        const caratParam = isGold ? `&carat=${carat}` : "";
        const [latestRes, compareRes, weeklyRes, monthlyRes] = await Promise.all([
          fetch(`${API_BASE}/get-latest-price?metal=${encodeURIComponent(selectedMetal)}${caratParam}`),
          fetch(`${API_BASE}/compare-yesterday?metal=${encodeURIComponent(selectedMetal)}${caratParam}`),
          fetch(`${API_BASE}/weekly-history?metal=${encodeURIComponent(selectedMetal)}${caratParam}`),
          fetch(`${API_BASE}/monthly-history?metal=${encodeURIComponent(selectedMetal)}${caratParam}`)
        ]);
        if (!latestRes.ok || !compareRes.ok || !weeklyRes.ok || !monthlyRes.ok) {
          throw new Error("Unable to load price data");
        }
        const latestData = await latestRes.json();
        const compareData = await compareRes.json();
        const weeklyData = await weeklyRes.json();
        const monthlyData = await monthlyRes.json();
        setStatus({ loading: false, error: "" });
        setLatest(latestData.latest || null);
        setComparison(compareData.comparison || null);
        setWeekly(weeklyData.history || []);
        setMonthly(monthlyData.history || []);
        setAvailableMonths(monthlyData.availableMonths || []);
        setSelectedMonth(monthlyData.selectedMonth || "");
      } catch (error) {
        setStatus({ loading: false, error: error.message });
      }
    };
    loadDetails();
  }, [selectedMetal, carat]);

  useEffect(() => {
    if (!selectedMonth || !selectedMetal) return;
    if (!availableMonths.includes(selectedMonth)) return;
    const loadMonth = async () => {
      try {
        const caratParam = isGold ? `&carat=${carat}` : "";
        const response = await fetch(
          `${API_BASE}/monthly-history?metal=${encodeURIComponent(selectedMetal)}${caratParam}&month=${selectedMonth}`
        );
        if (!response.ok) throw new Error("Unable to load month data");
        const data = await response.json();
        setMonthly(data.history || []);
      } catch (error) {
        setStatus((prev) => ({ ...prev, error: error.message }));
      }
    };
    loadMonth();
  }, [selectedMonth]);

  const unitOptions = unitsForMetal(selectedMetal);
  const priceValue = latest
    ? unit === "1g"
      ? latest.price_1g
      : unit === "8g"
      ? latest.price_8g
      : latest.price_per_kg
    : 0;

  const selectedPriceKey =
    unit === "1g" ? "price_1g" : unit === "8g" ? "price_8g" : "price_per_kg";

  const metalTheme = getMetalTheme(selectedMetal);

  const chartSeries = [
    {
      label: unit,
      key: selectedPriceKey,
      color: metalTheme.primary,
      fillColor: metalTheme.light
    }
  ];

  const allChartValues = [...weekly, ...monthly]
    .map((p) => p[selectedPriceKey])
    .filter(Number.isFinite);
  const chartRange = calculateChartRange(allChartValues);

  const unitComparison = comparison
    ? (() => {
        const todayPrice = comparison.today_prices?.[selectedPriceKey];
        const yesterdayPrice = comparison.yesterday_prices?.[selectedPriceKey];
        if (!Number.isFinite(todayPrice) || !Number.isFinite(yesterdayPrice)) return null;
        const difference = todayPrice - yesterdayPrice;
        const percentageChange = (difference / yesterdayPrice) * 100;
        const direction = difference > 0 ? "up" : difference < 0 ? "down" : "neutral";
        return { difference, percentage_change: percentageChange, direction };
      })()
    : null;

  const badgeClass = unitComparison?.direction || "neutral";
  const priceClass = unitComparison?.direction ? `stat-value ${unitComparison.direction}` : "stat-value";

  return (
    <div className="app">
      <div className="shell">
        <header className="hero">
          <div className="hero__title">
            <span className="eyebrow">Auric Ledger</span>
            <h1>Metal Price Observatory</h1>
            <p>
              A refined view of daily precious metal prices with INR conversion, duties, and GST baked in.
              Compare shifts, inspect purity bands, and follow weekly and monthly momentum.
            </p>
          </div>
          <div className="hero__panel">
            <div className="control-grid">
              <label>
                Metal
                <select value={selectedMetal} onChange={(event) => setSelectedMetal(event.target.value)}>
                  {metals.map((metal) => (
                    <option key={`${metal.metal_name}-${metal.carat || "na"}`} value={metal.metal_name}>
                      {formatMetalLabel(metal)}
                    </option>
                  ))}
                </select>
              </label>

              {isGold ? (
                <label>
                  Purity
                  <select value={carat} onChange={(event) => setCarat(event.target.value)}>
                    {goldCarats.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label>
                Unit
                <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                  {unitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Month
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  disabled={!availableMonths.length}
                >
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {dayjs(`${month}-01`).format("MMMM YYYY")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </header>

        {status.error ? (
          <div className="card">
            <strong>Data unavailable.</strong>
            <div>{status.error}</div>
          </div>
        ) : null}

        <section className="stat-grid">
          <div className="stat-card" style={{ "--accent": metalTheme.primary }}>
            <h3 className="stat-label">Latest Price ({unit})</h3>
            <div className={priceClass}>
              {formatMoney(priceValue)}
            </div>
            {unitComparison ? (
              <div className={`badge ${badgeClass}`}>
                {unitComparison.direction === "up" ? "▲" : unitComparison.direction === "down" ? "▼" : "■"}
                {formatMoney(unitComparison.difference)} ({unitComparison.percentage_change.toFixed(2)}%)
              </div>
            ) : null}
          </div>

          {isGold ? (
            <div className="stat-card" style={{ "--accent": metalTheme.secondary }}>
              <h3 className="stat-label">Gold Purities</h3>
              <div className="purity-list">
                {goldCarats.map((item) => (
                  <div key={item.value}>
                    <strong>{item.label}</strong>
                    <div className="stat-sub">
                      {formatMoney(latest?.carat_prices?.[item.value] || 0)} per 1g
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="stat-card" style={{ "--accent": metalTheme.secondary }}>
              <h3 className="stat-label">Per Kg</h3>
              <div className="stat-value">{formatMoney(latest?.price_per_kg || 0)}</div>
            </div>
          )}

          <div className="stat-card" style={{ "--accent": metalTheme.primary }}>
            <h3 className="stat-label">Update Date</h3>
            <div className="stat-value">{latest ? dayjs(latest.date).format("DD MMM YYYY") : "-"}</div>
          </div>
        </section>

        <section className="chart-grid">
          <div className="chart-panel">
            <div className="chart-title">
              <h2>Weekly Range {isGold && `• ${carat}K`}</h2>
              <span className="chart-meta">{unit}</span>
            </div>
            <Line data={buildChartData(weekly, chartSeries)} options={buildChartOptions(chartRange)} />
          </div>
          <div className="chart-panel">
            <div className="chart-title">
              <h2>Monthly Range {isGold && `• ${carat}K`}</h2>
              <span className="chart-meta">{unit}</span>
            </div>
            <Line data={buildChartData(monthly, chartSeries)} options={buildChartOptions(chartRange)} />
          </div>
        </section>

        {status.loading ? (
          <div className="loader-wrap">
            <div className="loader"></div>
            <p>Fetching precious metal prices...</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
