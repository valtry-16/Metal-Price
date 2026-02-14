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
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const runAutoTable = (doc, options) => {
  const tableFn = autoTable?.default || autoTable;
  return tableFn(doc, options);
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value ?? 0);

const formatNumberPlain = (value) => {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value ?? 0);
  return `Rs.${formatted}`;
};

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
  const [comparisons, setComparisons] = useState({});
  const [weekly, setWeekly] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [status, setStatus] = useState({ loading: true, error: "", message: "Initializing..." });
  const [downloadLink, setDownloadLink] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [metalSearch, setMetalSearch] = useState("");
  const [showFaq, setShowFaq] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isGold = useMemo(() => {
    return selectedMetal.toLowerCase().includes("gold") || selectedMetal.toLowerCase().includes("xau");
  }, [selectedMetal]);

  // Load dark mode preference
  useEffect(() => {
    const saved = localStorage.getItem("auric-dark-mode");
    if (saved === "true") {
      setDarkMode(true);
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("auric-dark-mode", newMode);
    if (newMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuOpen && !event.target.closest('.header-actions')) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Load filters from localStorage
  const loadFiltersFromStorage = () => {
    const savedMetal = localStorage.getItem("auric-metal");
    const savedCarat = localStorage.getItem("auric-carat") || "22";
    const savedUnit = localStorage.getItem("auric-unit") || "1g";
    return { savedMetal, savedCarat, savedUnit };
  };

  // Save filters to localStorage
  const saveFilters = (metal, caratVal, unitVal) => {
    if (metal) localStorage.setItem("auric-metal", metal);
    if (caratVal) localStorage.setItem("auric-carat", caratVal);
    if (unitVal) localStorage.setItem("auric-unit", unitVal);
  };

  const handleSetSelectedMetal = (metal) => {
    setSelectedMetal(metal);
    saveFilters(metal, carat, unit);
    setMetalSearch("");
  };

  const handleSetCarat = (caratVal) => {
    setCarat(caratVal);
    saveFilters(selectedMetal, caratVal, unit);
  };

  const handleSetUnit = (unitVal) => {
    setUnit(unitVal);
    saveFilters(selectedMetal, carat, unitVal);
  };

  useEffect(() => {
    const load = async () => {
      const { savedMetal, savedCarat, savedUnit } = loadFiltersFromStorage();
      setCarat(savedCarat);
      setUnit(savedUnit);
      try {
        setStatus({ loading: true, error: "", message: "Connecting to market data..." });
        const response = await fetch(`${API_BASE}/get-latest-price`);
        setStatus({ loading: true, error: "", message: "Loading available metals..." });
        if (!response.ok) throw new Error("Unable to fetch available metals. Please check your internet connection.");
        const data = await response.json();
        const filteredMetals = (data.metals || []).filter(m => !['BTC', 'ETH'].includes(m.metal_name));
        setMetals(filteredMetals);
        if (filteredMetals?.length) {
          const defaultGold = filteredMetals.find((metal) => {
            const symbol = (metal.metal_name || "").toLowerCase();
            const display = (metal.display_name || "").toLowerCase();
            const mapped = (metalLabelMap[metal.metal_name] || "").toLowerCase();
            return symbol.includes("xau") || display.includes("gold") || mapped.includes("gold");
          });
          const metalToSet = savedMetal || defaultGold?.metal_name || filteredMetals[0].metal_name;
          setSelectedMetal(metalToSet);
        }
      } catch (error) {
        setStatus({ loading: false, error: error.message, message: "" });
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedMetal) return;
    const loadDetails = async () => {
      try {
        setStatus({ loading: true, error: "", message: "Fetching latest prices..." });
        setDownloadLink(null);
        const caratParam = isGold ? `&carat=${carat}` : "";
        const [latestRes, compareRes, weeklyRes, monthlyRes] = await Promise.all([
          fetch(`${API_BASE}/get-latest-price?metal=${encodeURIComponent(selectedMetal)}${caratParam}`),
          fetch(`${API_BASE}/compare-yesterday?metal=${encodeURIComponent(selectedMetal)}${caratParam}`),
          fetch(`${API_BASE}/weekly-history?metal=${encodeURIComponent(selectedMetal)}${caratParam}`),
          fetch(`${API_BASE}/monthly-history?metal=${encodeURIComponent(selectedMetal)}${caratParam}`)
        ]);
        if (!latestRes.ok || !compareRes.ok || !weeklyRes.ok || !monthlyRes.ok) {
          throw new Error("Unable to load price data. Please check your connection and try again.");
        }
        setStatus({ loading: true, error: "", message: "Processing price data..." });
        const latestData = await latestRes.json();
        const compareData = await compareRes.json();
        const weeklyData = await weeklyRes.json();
        const monthlyData = await monthlyRes.json();
        setLatest(latestData.latest || null);
        setComparison(compareData.comparison || null);
        setWeekly(weeklyData.history || []);
        setMonthly(monthlyData.history || []);
        setAvailableMonths(monthlyData.availableMonths || []);
        setSelectedMonth(monthlyData.selectedMonth || "");

        // Fetch comparisons for ALL metals
        if (metals && metals.length > 0) {
          setStatus({ loading: true, error: "", message: "Loading all metal comparisons..." });
          const allComparisons = {};
          const comparePromises = metals
            .filter(m => !['BTC', 'ETH'].includes(m.metal_name))
            .map(async (metal) => {
              try {
                // Always use 22K for gold in ticker, no carat param for other metals
                const metalCaratParam = metal.metal_name.toLowerCase().includes("gold") || metal.metal_name.toLowerCase().includes("xau") ? "&carat=22" : "";
                const res = await fetch(
                  `${API_BASE}/compare-yesterday?metal=${encodeURIComponent(metal.metal_name)}${metalCaratParam}`
                );
                if (res.ok) {
                  const data = await res.json();
                  allComparisons[metal.metal_name] = data.comparison;
                }
              } catch (err) {
                console.error(`Failed to fetch comparison for ${metal.metal_name}:`, err);
              }
            });
          await Promise.all(comparePromises);
          setComparisons(allComparisons);
        }
        setStatus({ loading: false, error: "", message: "" });
      } catch (error) {
        setStatus({ loading: false, error: error.message, message: "" });
      }
    };
    loadDetails();
  }, [selectedMetal, carat, unit, metals]);

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
        setStatus((prev) => ({ ...prev, error: error.message, message: "" }));
      }
    };
    loadMonth();
  }, [selectedMonth]);

  useEffect(() => {
    return () => {
      if (downloadLink?.url) {
        URL.revokeObjectURL(downloadLink.url);
      }
    };
  }, [downloadLink?.url]);

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
  const lastUpdated = latest?.date ? dayjs(latest.date).format("DD MMM YYYY") : "—";

  const buildExportRows = () => {
    return weekly.map((entry) => ({
      date: dayjs(entry.date).format("DD MMM YYYY"),
      metal: `${formatMetalLabel({ metal_name: selectedMetal, display_name: metalLabelMap[selectedMetal] || null })}${
        isGold ? ` (${carat}K)` : ""
      }`,
      unit,
      price: formatMoney(entry[selectedPriceKey] || 0)
    }));
  };

  const getWeeklyStats = () => {
    const values = weekly
      .map((entry) => entry[selectedPriceKey])
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      return { min: 0, max: 0, avg: 0 };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { min, max, avg };
  };

  const getMonthlyStats = () => {
    const values = monthly
      .map((entry) => entry[selectedPriceKey])
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      return { min: 0, max: 0, avg: 0 };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { min, max, avg };
  };

  const monthlyStats = getMonthlyStats();

  // Filtered metals list for search
  const filteredMetals = metals.filter((metal) => {
    const label = formatMetalLabel(metal).toLowerCase();
    return label.includes(metalSearch.toLowerCase());
  });

  const handleExportCsv = () => {
    if (!weekly.length) return;
    if (downloadLink?.url) {
      URL.revokeObjectURL(downloadLink.url);
    }
    const rows = buildExportRows();
    const header = ["Date", "Metal", "Unit", "Price (INR)"];
    const csvLines = [header, ...rows.map((row) => [row.date, row.metal, row.unit, row.price])]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvLines], { type: "text/csv;charset=utf-8;" });
    const filename = `metal-prices-${selectedMetal}-${unit}-${dayjs().format("YYYYMMDD")}.csv`;
    const url = URL.createObjectURL(blob);
    setDownloadLink({ url, filename, label: "CSV" });
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };
if (downloadLink?.url) {
      URL.revokeObjectURL(downloadLink.url);
    }
    
  const handleExportPdf = async () => {
    if (!weekly.length) return;
    const rows = buildExportRows();
    const stats = getWeeklyStats();
    const dateRange = {
      start: dayjs(weekly[0].date).format("DD MMM YYYY"),
      end: dayjs(weekly[weekly.length - 1].date).format("DD MMM YYYY")
    };
    const loadLogoPng = async (src, size = 72) => {
      const response = await fetch(src);
      if (!response.ok) throw new Error("Logo fetch failed");
      const svgText = await response.text();
      const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
      const svgUrl = URL.createObjectURL(svgBlob);
      try {
        const image = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = svgUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        ctx.drawImage(image, 0, 0, size, size);
        return canvas.toDataURL("image/png");
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    };
    let logoDataUrl = null;
    try {
      logoDataUrl = await loadLogoPng("/metal-price-icon.svg", 72);
    } catch {
      logoDataUrl = null;
    }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    
    // Theme-aware colors
    const bgColor = darkMode ? [26, 24, 32] : [250, 247, 241];
    const textColor = darkMode ? [245, 241, 234] : [24, 24, 30];
    const mutedColor = darkMode ? [169, 173, 184] : [90, 90, 96];
    const accentColor = darkMode ? [212, 169, 84] : [197, 154, 60];
    const tableHeadBg = darkMode ? [42, 107, 95] : [181, 134, 11];
    const tableAltRowBg = darkMode ? [31, 28, 38] : [249, 247, 242];
    const tableTextColor = darkMode ? [245, 241, 234] : [40, 40, 40];
    
    // Full page background
    doc.setFillColor(...bgColor);
    doc.rect(0, 0, 595, 842, "F");
    
    // Header background
    doc.setFillColor(...bgColor);
    doc.rect(0, 0, 595, 96, "F");
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", 32, 22, 36, 36);
    } else {
      doc.setFillColor(...accentColor);
      doc.circle(48, 40, 14, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("AL", 43, 43);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...textColor);
    doc.text("Auric Ledger", 75, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...mutedColor);
    doc.text("Precision metal pricing for modern markets", 75, 60);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...textColor);
    doc.text("Metal Price Report", 40, 118);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...mutedColor);
    doc.text("https://auric-ledger.vercel.app/", 40, 133);
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text(
      `Metal: ${formatMetalLabel({ metal_name: selectedMetal, display_name: metalLabelMap[selectedMetal] || null })}${
        isGold ? ` (${carat}K)` : ""
      }`,
      40,
      153
    );
    doc.text(`Unit: ${unit}`, 40, 173);
    doc.text(`Range: ${dateRange.start} to ${dateRange.end}`, 40, 193);
    doc.text(`Last updated: ${lastUpdated}`, 40, 213);
    doc.text(`Generated: ${dayjs().format("DD MMM YYYY, HH:mm")}`, 40, 233);

    doc.setFont("helvetica", "bold");
    doc.text("7-Day Summary", 40, 261);
    doc.setFont("helvetica", "normal");
    doc.text(`Low: ${formatNumberPlain(stats.min)}`, 40, 281);
    doc.text(`High: ${formatNumberPlain(stats.max)}`, 220, 281);
    doc.text(`Average: ${formatNumberPlain(stats.avg)}`, 400, 281);

    if (unitComparison) {
      doc.text(
        `Change vs yesterday: ${formatNumberPlain(unitComparison.difference)} (${unitComparison.percentage_change.toFixed(2)}%)`,
        40,
        303
      );
    }

    const pdfRows = weekly.map((entry) => [
      dayjs(entry.date).format("DD MMM YYYY"),
      `${formatMetalLabel({ metal_name: selectedMetal, display_name: metalLabelMap[selectedMetal] || null })}${
        isGold ? ` (${carat}K)` : ""
      }`,
      unit,
      formatNumberPlain(entry[selectedPriceKey] || 0)
    ]);

    runAutoTable(doc, {
      startY: unitComparison ? 323 : 313,
      head: [["Date", "Metal", "Unit", "Price (Rs.)"]],
      body: pdfRows,
      theme: "grid",
      headStyles: {
        fillColor: tableHeadBg,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "left"
      },
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 6,
        textColor: tableTextColor,
        fillColor: bgColor
      },
      columnStyles: {
        2: { halign: "center" },
        3: { halign: "right" }
      },
      alternateRowStyles: { fillColor: tableAltRowBg }
    });

    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.text("Auric Ledger • https://auric-ledger.vercel.app/", 40, 820);
    doc.text(`Page 1 of ${pageCount}`, 520, 820);

    const filename = `metal-prices-${selectedMetal}-${unit}-${dayjs().format("YYYYMMDD")}.pdf`;
    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    setDownloadLink({ url, filename, label: "PDF" });
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  const handleCopyDownloadLink = async () => {
    if (!downloadLink?.url) return;
    try {
      await navigator.clipboard.writeText(downloadLink.url);
    } catch (error) {
      console.error("Unable to copy download link", error);
    }
  };

  return (
    <div className="app">
      <div className="shell">
        <div className="hero__header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src="/metal-price-icon.svg" alt="Auric Ledger" style={{ width: "32px", height: "32px" }} />
            <span className="eyebrow">Auric Ledger</span>
          </div>
          <div className="header-actions">
            <button className="theme-toggle desktop-only" onClick={toggleDarkMode}>
              {darkMode ? "Light" : "Dark"}
            </button>
            <button className="theme-toggle desktop-only" onClick={() => setShowFaq(true)}>
              About
            </button>
            <button 
              className="mobile-menu-toggle" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="mobile-menu-dropdown">
              <button className="theme-toggle" onClick={() => { toggleDarkMode(); setMobileMenuOpen(false); }}>
                {darkMode ? "Light" : "Dark"}
              </button>
              <button className="theme-toggle" onClick={() => { setShowFaq(true); setMobileMenuOpen(false); }}>
                About
              </button>
            </div>
          )}
        </div>
        <header className="hero">
          <div className="hero__title">
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
                <input
                  type="text"
                  className="search-metals"
                  placeholder="Search metals..."
                  value={metalSearch}
                  onChange={(e) => setMetalSearch(e.target.value)}
                />
                <select value={selectedMetal} onChange={(event) => handleSetSelectedMetal(event.target.value)}>
                  {filteredMetals.map((metal) => (
                    <option key={`${metal.metal_name}-${metal.carat || "na"}`} value={metal.metal_name}>
                      {formatMetalLabel(metal)}
                    </option>
                  ))}
                  {!filteredMetals.length && metals.length > 0 && (
                    <option disabled>No metals match "{metalSearch}"</option>
                  )}
                </select>
              </label>

              {isGold ? (
                <label>
                  Purity
                  <select value={carat} onChange={(event) => handleSetCarat(event.target.value)}>
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
                <select value={unit} onChange={(event) => handleSetUnit(event.target.value)}>
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

        {metals.length > 0 && (
          <div className="live-ticker">
            <div className="ticker-wrapper">
              <div className="ticker-content">
                {metals
                  .filter(m => !['BTC', 'ETH'].includes(m.metal_name))
                  .map((metal) => {
                    const metalComparison = comparisons[metal.metal_name];
                    const theme = getMetalTheme(metal.metal_name);
                    
                    let direction = "neutral";
                    let change = "—";
                    let percentage = "0";
                    let message = "";

                    if (metalComparison) {
                      // Always show 1g prices in ticker (22K for gold, 1g for others)
                      const todayPrice = metalComparison.today_prices?.price_1g;
                      const yesterdayPrice = metalComparison.yesterday_prices?.price_1g;
                      
                      if (Number.isFinite(todayPrice) && Number.isFinite(yesterdayPrice)) {
                        const diff = todayPrice - yesterdayPrice;
                        const pct = (diff / yesterdayPrice) * 100;
                        direction = diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
                        change = Math.abs(diff).toFixed(2);
                        percentage = Math.abs(pct).toFixed(2);
                        
                        const isGoldMetal = metal.metal_name.toLowerCase().includes("gold") || metal.metal_name.toLowerCase().includes("xau");
                        const caratLabel = isGoldMetal ? " (22K)" : "";
                        
                        if (direction === "up") {
                          message = `▲ ${formatMetalLabel(metal)}${caratLabel} increased by ₹${change} (${percentage}%)`;
                        } else if (direction === "down") {
                          message = `▼ ${formatMetalLabel(metal)}${caratLabel} decreased by ₹${change} (${percentage}%)`;
                        } else {
                          message = `⬤ ${formatMetalLabel(metal)}${caratLabel} - No change`;
                        }
                      }
                    }

                    return (
                      <span key={metal.metal_name} className={`ticker-item ${direction}`} style={{ color: theme.primary }}>
                        {message}
                      </span>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {status.error ? (
          <div className="error-banner">
            <strong>⚠️ Data Unavailable</strong>
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

        <section className="export-bar">
          <div className="export-meta">
            <span>Last updated: {lastUpdated}</span>
            <span>Source: gold-api.com</span>
            {downloadLink ? (
              <div className="download-fallback">
                <span>Download link for {downloadLink.label} (use if download did not start)</span>
                <div className="download-actions">
                  <a href={downloadLink.url} download={downloadLink.filename} className="download-link">
                    Open download link
                  </a>
                  <button className="download-copy" type="button" onClick={handleCopyDownloadLink}>
                    Copy link
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="export-actions">
            <button className="export-btn" type="button" onClick={handleExportCsv}>
              Download CSV
            </button>
            <button className="export-btn" type="button" onClick={handleExportPdf}>
              Download PDF
            </button>
          </div>
        </section>

        <section className="chart-grid">
          <div className="chart-panel">
            <div className="chart-title">
              <h2>
                Weekly Range{isGold ? <span className="chart-carat"> • {carat}K</span> : null}
              </h2>
              <span className="chart-meta">{unit}</span>
            </div>
            <Line data={buildChartData(weekly, chartSeries)} options={buildChartOptions(chartRange)} />
          </div>
          <div className="chart-panel">
            <div className="chart-title">
              <h2>
                Monthly Range{isGold ? <span className="chart-carat"> • {carat}K</span> : null}
              </h2>
              <span className="chart-meta">{unit}</span>
            </div>
            <Line data={buildChartData(monthly, chartSeries)} options={buildChartOptions(chartRange)} />
          </div>
        </section>

        {status.loading ? (
          <div className="loading-screen" role="status" aria-live="polite">
            <div className="loading-card">
              <div className="loading-orb"></div>
              <div className="loading-text">
                <h3>Loading Market Data</h3>
                <p>{status.message || "Please wait..."}</p>
              </div>
            </div>
          </div>
        ) : null}

        {showFaq ? (
          <div className="modal-overlay" onClick={() => setShowFaq(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <img src="/metal-price-icon.svg" alt="Auric Ledger" style={{ width: "36px", height: "36px" }} />
                  <h2>Auric Ledger</h2>
                </div>
                <button className="modal-close" onClick={() => setShowFaq(false)}>
                  ✕
                </button>
              </div>
              <div className="faq-section">
                <div className="faq-item">
                  <h3>What is Auric Ledger?</h3>
                  <p>
                    A premium precious metals price tracker providing live market data with INR conversion,
                    duty calculations, and GST applied. Track gold, silver, platinum, palladium, and copper with precision
                    and confidence. Real-time updates, historical trends, and downloadable reports.
                  </p>
                </div>
                <div className="faq-item">
                  <h3>What are Gold Purities (Carats)?</h3>
                  <p>
                    <strong style={{ color: "var(--accent)" }}>18 Carat:</strong> 75% pure gold (18/24), ideal for jeweled items.
                    <br />
                    <strong style={{ color: "var(--accent)" }}>22 Carat:</strong> 91.6% pure gold (22/24), primary choice in India.
                    <br />
                    <strong style={{ color: "var(--accent)" }}>24 Carat:</strong> 99.9% pure gold, investment-grade bullion.
                  </p>
                </div>
                <div className="faq-item">
                  <h3>How are prices calculated?</h3>
                  <p>
                    Base prices sourced from gold-api.com (USD/troy oz). Converted to INR via frankfurter.app rates.
                    Ounce-to-gram conversion applied (1 oz = 31.1035g). Gold purity multipliers reduce rates by carat.
                    Duty and GST (5%) included in all displayed prices. Fully transparent methodology.
                  </p>
                </div>
                <div className="faq-item">
                  <h3>How often are prices updated?</h3>
                  <p>
                    Daily sync at 09:00 AM IST with cron automation. Manual API updates available on demand.
                    Historical records: last 7 days (weekly) and monthly breakdowns. Zero data loss with Supabase.
                  </p>
                </div>
                <div className="faq-item">
                  <h3>What do the color badges mean?</h3>
                  <p>
                    <strong style={{ color: "var(--up)" }}>Red ▲</strong>: Price surged vs yesterday.
                    <br />
                    <strong style={{ color: "var(--down)" }}>Green ▼</strong>: Price dipped vs yesterday.
                    <br />
                    Alerts trigger for &gt;1% swings. Premium notifications for all metals.
                  </p>
                </div>
                <div className="faq-item">
                  <h3>Can I export the data?</h3>
                  <p>
                    Download 7-day price history as CSV or premium PDF reports with charts and branding.
                    Mobile-friendly fallback links ensure exports work everywhere. Save for records and analysis.
                  </p>
                </div>
                <div className="faq-item">
                  <h3>Dark Mode & Privacy</h3>
                  <p>
                    Dark mode saves eye strain during after-hours trading. Your theme and filter preferences persist
                    locally via localStorage—no servers involved. Complete privacy with no tracking.
                  </p>
                </div>
                <div className="faq-item">
                  <h3>Meet the Team</h3>
                  <p>
                    Built with precision for serious precious metals traders and investors. Powered by React, Node.js, 
                    Supabase, and automated cron scheduling. Deployed globally on Vercel (frontend) and Render (backend).
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
