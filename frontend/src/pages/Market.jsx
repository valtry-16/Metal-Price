import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import dayjs from "dayjs";
import Chart from "react-apexcharts";
import { useTheme } from "../contexts/ThemeContext";
import { PROD_API_URL, IS_DEV, goldCarats, metalLabelMap, metalThemes, METAL_ORDER } from "../utils/constants";
import {
  formatMoney, formatNumberPlain, unitsForMetal, formatMetalLabel,
  getMetalTheme, sortMetals, maskEmail, loadPdfLibs
} from "../utils/helpers";
import MarketTicker from "../components/market/MarketTicker";
import MarketInsight from "../components/market/MarketInsight";
import AlertsModal from "../components/market/AlertsModal";
import "./Market.css";

// Precious metals shown as hero tabs
const HERO_METALS = [
  { symbol: "XAU", label: "Gold" },
  { symbol: "XAG", label: "Silver" },
  { symbol: "XPT", label: "Platinum" },
  { symbol: "XPD", label: "Palladium" },
];

export default function Market() {
  const { darkMode } = useTheme();
  const apiBase = PROD_API_URL;

  // ─── Core data state ────────────────────────────────────────
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

  // ─── Export / download state ────────────────────────────────
  const [downloadLink, setDownloadLink] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  // ─── AI Summary state ───────────────────────────────────────
  const [dailySummary, setDailySummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryGenerating, setSummaryGenerating] = useState(false);

  // ─── Modals ─────────────────────────────────────────────────
  const [showFaq, setShowFaq] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  // ─── Alert system ───────────────────────────────────────────
  const [alerts, setAlerts] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [newAlert, setNewAlert] = useState({ metal: "", type: "price_threshold", direction: "below", value: "", enabled: true });
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [userEmail, setUserEmail] = useState("");
  const [savedEmailMask, setSavedEmailMask] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  // ─── Derived values ─────────────────────────────────────────
  const isGold = useMemo(() => {
    return selectedMetal.toLowerCase().includes("gold") || selectedMetal.toLowerCase().includes("xau");
  }, [selectedMetal]);

  const unitOptions = unitsForMetal(selectedMetal);
  const selectedPriceKey = unit === "1g" ? "price_1g" : unit === "8g" ? "price_8g" : "price_per_kg";
  const metalTheme = getMetalTheme(selectedMetal);

  const priceValue = latest
    ? (unit === "1g" ? latest.price_1g : unit === "8g" ? latest.price_8g : latest.price_per_kg)
    : 0;

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

  const lastUpdated = latest?.date ? dayjs(latest.date).format("DD MMM YYYY") : "—";

  // ─── Weekly / monthly stats ─────────────────────────────────
  const getStats = (data) => {
    const values = data.map((entry) => entry[selectedPriceKey]).filter(Number.isFinite);
    if (!values.length) return { min: 0, max: 0, avg: 0, first: 0, last: 0 };
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((s, v) => s + v, 0) / values.length,
      first: values[0],
      last: values[values.length - 1],
    };
  };

  const weeklyStats = useMemo(() => getStats(weekly), [weekly, selectedPriceKey]);
  const monthlyStats = useMemo(() => getStats(monthly), [monthly, selectedPriceKey]);

  // ─── ApexCharts build helpers ───────────────────────────────
  const buildApexSeries = (data) => [{
    name: `Price (${unit})`,
    data: data.map((p) => p[selectedPriceKey]).filter(Number.isFinite),
  }];

  const buildApexOptions = (data, stats, title) => {
    const labels = data.map((p) => dayjs(p.date).format("DD MMM"));
    const padding = Math.max((stats.max - stats.min) * 0.12, 1);

    return {
      chart: {
        type: "area",
        height: 280,
        toolbar: { show: false },
        fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
        zoom: { enabled: false },
        animations: { enabled: true, easing: "easeinout", speed: 600 },
      },
      colors: [metalTheme.primary],
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.05,
          stops: [0, 100],
        },
      },
      stroke: { curve: "smooth", width: 3 },
      markers: {
        size: 4,
        colors: [metalTheme.primary],
        strokeColors: darkMode ? "#1c1a24" : "#ffffff",
        strokeWidth: 2,
      },
      xaxis: {
        categories: labels,
        labels: { style: { colors: darkMode ? "#a9adb8" : "#5d6b7a", fontSize: "11px" } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        min: Math.max(0, stats.min - padding),
        max: stats.max + padding,
        labels: {
          formatter: (val) => formatNumberPlain(val),
          style: { colors: darkMode ? "#a9adb8" : "#5d6b7a", fontSize: "11px" },
        },
      },
      grid: {
        borderColor: darkMode ? "#2e2b38" : "rgba(200,200,200,0.2)",
        strokeDashArray: 4,
      },
      tooltip: {
        theme: darkMode ? "dark" : "light",
        y: { formatter: (val) => formatMoney(val) },
      },
      dataLabels: { enabled: false },
    };
  };

  // ─── Toast & Notification helpers ───────────────────────────
  const showToast = (message, duration = 4000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  };

  const showNotification = (title, options = {}) => {
    if (notificationPermission === "granted" && "Notification" in window) {
      new Notification(title, { icon: "/metal-price-icon.svg", badge: "/metal-price-icon.svg", ...options });
    }
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === "granted";
    }
    return false;
  };

  // ─── Alert CRUD ─────────────────────────────────────────────
  const saveAlerts = (updated) => {
    setAlerts(updated);
    localStorage.setItem("auric-alerts", JSON.stringify(updated));
  };

  const addAlert = () => {
    if (!newAlert.metal || !newAlert.value) {
      showToast("Please select a metal and enter a value");
      return;
    }
    const alert = {
      id: Date.now(),
      metal: newAlert.metal,
      type: newAlert.type,
      direction: newAlert.type === "price_threshold" ? newAlert.direction : null,
      value: parseFloat(newAlert.value),
      enabled: true,
      createdAt: new Date().toISOString(),
      lastTriggeredAt: null,
    };
    saveAlerts([...alerts, alert]);
    setNewAlert({ metal: "", type: "price_threshold", direction: "below", value: "", enabled: true });
    showToast(`Alert created for ${formatMetalLabel({ metal_name: newAlert.metal })}`);
  };

  const deleteAlert = (id) => { saveAlerts(alerts.filter((a) => a.id !== id)); showToast("Alert deleted"); };
  const toggleAlert = (id) => { saveAlerts(alerts.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a)); };

  const checkAlerts = async (metalName, currentPrice) => {
    if (!currentPrice || !alerts.length) return;
    for (const alert of alerts) {
      if (!alert.enabled || alert.metal !== metalName) continue;
      const now = new Date();
      const lastTriggered = alert.lastTriggeredAt ? new Date(alert.lastTriggeredAt) : null;
      if (lastTriggered && (now - lastTriggered) / 60000 < 60) continue;

      let shouldTrigger = false;
      let message = "";

      if (alert.type === "price_threshold" || alert.type === "target_price") {
        const dir = alert.direction || "below";
        if (dir === "below" && currentPrice <= alert.value) {
          shouldTrigger = true;
          message = `${formatMetalLabel({ metal_name: alert.metal })} dropped below ₹${alert.value.toFixed(2)}/g! Current: ₹${currentPrice.toFixed(2)}/g`;
        } else if (dir === "above" && currentPrice >= alert.value) {
          shouldTrigger = true;
          message = `${formatMetalLabel({ metal_name: alert.metal })} crossed above ₹${alert.value.toFixed(2)}/g! Current: ₹${currentPrice.toFixed(2)}/g`;
        }
      } else if (alert.type === "percentage_change") {
        const comp = comparisons[metalName];
        if (comp) {
          const oldPrice = comp.yesterday_prices?.price_1g || 0;
          if (oldPrice > 0) {
            const pctChange = ((currentPrice - oldPrice) / oldPrice) * 100;
            if (Math.abs(pctChange) >= alert.value) {
              shouldTrigger = true;
              message = `${Math.abs(pctChange).toFixed(2)}% move! ${formatMetalLabel({ metal_name: alert.metal })} ${pctChange > 0 ? "increased" : "decreased"}`;
            }
          }
        }
      }

      if (shouldTrigger) {
        if (notificationPermission === "granted") showNotification("Auric Ledger - Price Alert", { body: message });
        else showToast(message);

        if (userEmail) {
          try {
            await fetch(`${apiBase}/trigger-price-alert`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: userEmail, metalName: alert.metal, currentPrice,
                alertType: alert.type, alertDirection: alert.direction || "below",
                targetValue: alert.value, browserNotificationEnabled: notificationPermission === "granted",
              }),
            });
          } catch {}
        }
        saveAlerts(alerts.map((a) => a.id === alert.id ? { ...a, lastTriggeredAt: now.toISOString() } : a));
      }
    }
  };

  // ─── Email subscription ─────────────────────────────────────
  const saveEmail = async (email) => {
    if (!email || !email.includes("@")) { showToast("Please enter a valid email"); return; }
    setEmailLoading(true);
    try {
      const response = await fetch(`${apiBase}/subscribe-email`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("Failed to subscribe");
      const masked = maskEmail(email);
      if (rememberEmail) localStorage.setItem("auric-email", email);
      else localStorage.removeItem("auric-email");
      localStorage.setItem("auric-email-mask", masked);
      setUserEmail(rememberEmail ? email : "");
      setSavedEmailMask(masked);
      showToast("Daily price emails enabled for " + masked);
    } catch (err) {
      showToast("Failed to subscribe: " + err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  const removeEmail = () => {
    setUserEmail("");
    setSavedEmailMask("");
    setRememberEmail(false);
    localStorage.removeItem("auric-email");
    localStorage.removeItem("auric-email-mask");
    showToast("Email notifications disabled");
  };

  // ─── Filter persistence ─────────────────────────────────────
  const loadFilters = () => ({
    savedMetal: localStorage.getItem("auric-metal"),
    savedCarat: localStorage.getItem("auric-carat") || "22",
    savedUnit: localStorage.getItem("auric-unit") || "1g",
  });

  const saveFilters = (m, c, u) => {
    if (m) localStorage.setItem("auric-metal", m);
    if (c) localStorage.setItem("auric-carat", c);
    if (u) localStorage.setItem("auric-unit", u);
  };

  const handleSetMetal = (symbol) => {
    setSelectedMetal(symbol);
    saveFilters(symbol, carat, unit);
  };

  const handleSetCarat = (val) => { setCarat(val); saveFilters(selectedMetal, val, unit); };
  const handleSetUnit = (val) => { setUnit(val); saveFilters(selectedMetal, carat, val); };

  // ─── Export handlers ────────────────────────────────────────
  const buildExportRows = () =>
    weekly.map((entry) => ({
      date: dayjs(entry.date).format("DD MMM YYYY"),
      metal: `${formatMetalLabel({ metal_name: selectedMetal, display_name: metalLabelMap[selectedMetal] || null })}${isGold ? ` (${carat}K)` : ""}`,
      unit,
      price: formatMoney(entry[selectedPriceKey] || 0),
    }));

  const handleExportCsv = () => {
    if (!weekly.length) return;
    if (downloadLink?.url) URL.revokeObjectURL(downloadLink.url);
    const rows = buildExportRows();
    const csvLines = [["Date", "Metal", "Unit", "Price (INR)"], ...rows.map((r) => [r.date, r.metal, r.unit, r.price])]
      .map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvLines], { type: "text/csv;charset=utf-8;" });
    const filename = `metal-prices-${selectedMetal}-${unit}-${dayjs().format("YYYYMMDD")}.csv`;
    const url = URL.createObjectURL(blob);
    setDownloadLink({ url, filename, label: "CSV" });
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
  };

  const handleExportPdf = async () => {
    if (!weekly.length) return;
    try {
      setExportLoading(true);
      const { jsPDF } = await loadPdfLibs();
      const rows = buildExportRows();
      const stats = weeklyStats;
      const dateRange = { start: dayjs(weekly[0].date).format("DD MMM YYYY"), end: dayjs(weekly[weekly.length - 1].date).format("DD MMM YYYY") };

      // Convert SVG to PNG for PDF
      let logoPngUrl = null;
      try {
        const response = await fetch("/metal-price-icon.svg");
        if (response.ok) {
          const svgText = await response.text();
          logoPngUrl = await new Promise((resolve) => {
            const canvas = document.createElement("canvas"); canvas.width = 72; canvas.height = 72;
            const ctx = canvas.getContext("2d");
            const encoded = encodeURIComponent(svgText);
            const img = new Image();
            img.onload = () => { ctx.drawImage(img, 0, 0, 72, 72); resolve(canvas.toDataURL("image/png")); };
            img.onerror = () => resolve(null);
            img.src = `data:image/svg+xml;charset=utf-8,${encoded}`;
            setTimeout(() => resolve(null), 3000);
          });
        }
      } catch {}

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const bgColor = darkMode ? [26, 24, 32] : [250, 247, 241];
      const textColor = darkMode ? [245, 241, 234] : [24, 24, 30];
      const mutedColor = darkMode ? [169, 173, 184] : [90, 90, 96];
      const accentColor = darkMode ? [212, 169, 84] : [197, 154, 60];
      const tableHeadBg = darkMode ? [42, 107, 95] : [181, 134, 11];
      const tableAltRowBg = darkMode ? [31, 28, 38] : [249, 247, 242];
      const tableTextColor = darkMode ? [245, 241, 234] : [40, 40, 40];

      doc.setFillColor(...bgColor); doc.rect(0, 0, 595, 842, "F");
      if (logoPngUrl) { try { doc.addImage(logoPngUrl, "PNG", 32, 22, 36, 36); } catch {} }
      doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...textColor); doc.text("Auric Ledger", 75, 42);
      doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...mutedColor); doc.text("Precision metal pricing for modern markets", 75, 60);
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...textColor); doc.text("Auric Ledger Report", 40, 115);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...mutedColor);
      doc.text("https://auric-ledger.vercel.app/", 40, 130);

      let y = 150;
      doc.setFontSize(11); doc.setTextColor(...textColor);
      [`Metal: ${formatMetalLabel({ metal_name: selectedMetal })}${isGold ? ` (${carat}K)` : ""}`, `Unit: ${unit}`,
        `Date Range: ${dateRange.start} to ${dateRange.end}`, `Last Updated: ${lastUpdated}`,
        `Generated: ${dayjs().format("DD MMM YYYY, HH:mm")}`
      ].forEach((line) => { doc.text(line, 40, y); y += 16; });

      y += 8;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...textColor); doc.text("7-Day Summary", 40, y); y += 18;
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      [`Low: ${formatNumberPlain(stats.min)}`, `High: ${formatNumberPlain(stats.max)}`, `Average: ${formatNumberPlain(stats.avg)}`].forEach((l) => { doc.text(l, 40, y); y += 16; });
      if (unitComparison) { doc.text(`Change vs Yesterday: ${formatNumberPlain(unitComparison.difference)} (${unitComparison.percentage_change.toFixed(2)}%)`, 40, y); y += 16; }

      y += 8;
      doc.autoTable({
        startY: y,
        head: [["Date", "Metal", "Unit", "Price (Rs.)"]],
        body: weekly.map((e) => [dayjs(e.date).format("DD MMM YYYY"), `${formatMetalLabel({ metal_name: selectedMetal })}${isGold ? ` (${carat}K)` : ""}`, unit, formatNumberPlain(e[selectedPriceKey] || 0)]),
        theme: "grid",
        headStyles: { fillColor: tableHeadBg, textColor: [255, 255, 255], fontStyle: "bold", halign: "left", fontSize: 11 },
        styles: { font: "helvetica", fontSize: 10, cellPadding: 8, textColor: tableTextColor, fillColor: bgColor, lineColor: 180 },
        columnStyles: { 0: { halign: "left" }, 1: { halign: "left" }, 2: { halign: "center" }, 3: { halign: "right" } },
        alternateRowStyles: { fillColor: tableAltRowBg },
        margin: { left: 40, right: 40 },
      });

      doc.setFontSize(9); doc.setTextColor(...mutedColor);
      doc.text("Auric Ledger", 40, 820);
      doc.text(`Page 1 of ${doc.getNumberOfPages()}`, 520, 820);

      const filename = `metal-prices-${selectedMetal}-${unit}-${dayjs().format("YYYYMMDD")}.pdf`;
      const pdfBlob = doc.output("blob");
      if (downloadLink?.url) URL.revokeObjectURL(downloadLink.url);
      const url = URL.createObjectURL(pdfBlob);
      setDownloadLink({ url, filename, label: "PDF" });
      const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
    } catch (err) {
      showToast("PDF export failed: " + err.message);
    } finally {
      setExportLoading(false);
    }
  };

  // ─── EFFECTS ────────────────────────────────────────────────

  // Load alerts + email from localStorage
  useEffect(() => {
    try { const saved = localStorage.getItem("auric-alerts"); if (saved) setAlerts(JSON.parse(saved)); } catch {}
    const email = localStorage.getItem("auric-email");
    const mask = localStorage.getItem("auric-email-mask");
    if (email) { setUserEmail(email); setSavedEmailMask(maskEmail(email)); setRememberEmail(true); }
    else if (mask) { setSavedEmailMask(mask); }
    if ("Notification" in window) setNotificationPermission(Notification.permission);
  }, []);

  // Load metals list + set default
  useEffect(() => {
    (async () => {
      const { savedMetal, savedCarat, savedUnit } = loadFilters();
      setCarat(savedCarat); setUnit(savedUnit);
      try {
        setStatus({ loading: true, error: "", message: "Connecting to market data..." });
        const res = await fetch(`${apiBase}/get-latest-price`);
        if (!res.ok) throw new Error("Unable to fetch metals.");
        const data = await res.json();
        const filtered = sortMetals((data.metals || []).filter((m) => !["BTC", "ETH", "HG"].includes(m.metal_name)));
        setMetals(filtered);
        if (filtered.length) {
          const gold = filtered.find((m) => m.metal_name === "XAU");
          setSelectedMetal(savedMetal || gold?.metal_name || filtered[0].metal_name);
        }
      } catch (err) {
        setStatus({ loading: false, error: err.message, message: "" });
      }
    })();
  }, []);

  // Fetch AI summary + SSE
  useEffect(() => {
    setSummaryLoading(true);
    fetch(`${apiBase}/daily-summary`).then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.summary) setDailySummary({ date: d.date, summary: d.summary }); if (d?.generating) setSummaryGenerating(true); })
      .catch(() => {}).finally(() => setSummaryLoading(false));

    let es;
    try {
      es = new EventSource(`${apiBase}/summary-events`);
      es.addEventListener("connected", (e) => { const d = JSON.parse(e.data); if (d.generating) setSummaryGenerating(true); });
      es.addEventListener("generating", () => setSummaryGenerating(true));
      es.addEventListener("complete", (e) => { const d = JSON.parse(e.data); setSummaryGenerating(false); if (d.summary) setDailySummary({ date: d.date, summary: d.summary }); });
      es.addEventListener("error", () => setSummaryGenerating(false));
    } catch {}
    return () => { if (es) es.close(); };
  }, []);

  // Fetch market data for selected metal (combined endpoint)
  useEffect(() => {
    if (!selectedMetal) return;
    (async () => {
      try {
        setStatus({ loading: true, error: "", message: "Fetching prices..." });
        setDownloadLink(null);
        const caratParam = isGold ? `&carat=${carat}` : "";
        const monthParam = selectedMonth ? `&month=${selectedMonth}` : "";
        const res = await fetch(`${apiBase}/market-data?metal=${encodeURIComponent(selectedMetal)}${caratParam}${monthParam}`);
        if (!res.ok) throw new Error("Unable to load price data.");
        const data = await res.json();
        setLatest(data.latest || null);
        setComparison(data.comparison || null);
        setWeekly(data.weekly || []);
        setMonthly(data.monthly || []);
        setAvailableMonths(data.availableMonths || []);
        if (!selectedMonth && data.selectedMonth) setSelectedMonth(data.selectedMonth);

        // Deferred: fetch all metals comparisons for ticker
        if (metals.length) {
          const idle = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (cb) => setTimeout(cb, 0);
          idle(async () => {
            const allComp = {};
            await Promise.all(
              metals.filter((m) => !["BTC", "ETH", "HG"].includes(m.metal_name)).map(async (metal) => {
                try {
                  const cp = metal.metal_name === "XAU" ? "&carat=22" : "";
                  const r = await fetch(`${apiBase}/compare-yesterday?metal=${encodeURIComponent(metal.metal_name)}${cp}`);
                  if (r.ok) { const d = await r.json(); allComp[metal.metal_name] = d.comparison; }
                } catch {}
              })
            );
            setComparisons(allComp);
            setStatus({ loading: false, error: "", message: "" });
          }, { timeout: 2000 });
        } else {
          setStatus({ loading: false, error: "", message: "" });
        }

        if (data.latest?.price_1g) checkAlerts(selectedMetal, data.latest.price_1g);
      } catch (err) {
        setStatus({ loading: false, error: err.message, message: "" });
      }
    })();
  }, [selectedMetal, carat, unit, metals]);

  // Fetch monthly data on month change (only when user explicitly changes month)
  useEffect(() => {
    if (!selectedMonth || !selectedMetal) return;
    if (!availableMonths.includes(selectedMonth)) return;
    (async () => {
      try {
        const caratParam = isGold ? `&carat=${carat}` : "";
        const res = await fetch(`${apiBase}/monthly-history?metal=${encodeURIComponent(selectedMetal)}${caratParam}&month=${selectedMonth}`);
        if (!res.ok) throw new Error("Unable to load month data");
        const data = await res.json();
        setMonthly(data.history || []);
      } catch {}
    })();
  }, [selectedMonth]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => { if (downloadLink?.url) URL.revokeObjectURL(downloadLink.url); };
  }, [downloadLink?.url]);

  // ─── RENDER ─────────────────────────────────────────────────
  const changeDir = unitComparison?.direction || "neutral";
  const changeArrow = changeDir === "up" ? "+" : changeDir === "down" ? "-" : "";

  return (
    <div className="al-market">
      <div className="al-market-shell">
        {/* ─── 1. Market Hero Panel ─────────────────────────── */}
        <section className="al-market-hero">
          <div className="al-market-hero-top">
            <div className="al-market-hero-price-section">
              <div className="al-market-hero-eyebrow">
                <span className="al-market-hero-metal-name">
                  {metalLabelMap[selectedMetal] || selectedMetal}
                </span>
                {isGold && <span className="al-market-hero-purity">{carat}K</span>}
                <span className="al-market-hero-unit">{unit === "1g" ? "per gram" : unit === "8g" ? "per 8g" : "per kg"}</span>
              </div>

              <div className="al-market-hero-price">
                {Number.isFinite(priceValue) ? formatMoney(priceValue) : "—"}
              </div>

              {unitComparison && (
                <span className={`al-market-hero-change ${changeDir}`}>
                  {changeArrow}{formatMoney(Math.abs(unitComparison.difference))} ({unitComparison.percentage_change.toFixed(2)}%)
                </span>
              )}

              <div className="al-market-hero-updated">
                Last updated: {lastUpdated} &bull; Source: apised.com
              </div>
            </div>
          </div>

          {/* Metal Tabs */}
          <div className="al-market-metal-tabs" role="tablist">
            {HERO_METALS.map((m) => (
              <button
                key={m.symbol}
                role="tab"
                aria-selected={selectedMetal === m.symbol}
                className={`al-market-metal-tab ${selectedMetal === m.symbol ? "active" : ""}`}
                onClick={() => handleSetMetal(m.symbol)}
              >
                {m.label}
              </button>
            ))}
            {/* Additional metals dropdown */}
            {metals.filter((m) => !HERO_METALS.some((h) => h.symbol === m.metal_name) && !["BTC", "ETH", "HG"].includes(m.metal_name)).length > 0 && (
              <select
                className="al-market-metal-tab"
                value={HERO_METALS.some((h) => h.symbol === selectedMetal) ? "" : selectedMetal}
                onChange={(e) => { if (e.target.value) handleSetMetal(e.target.value); }}
                style={{ minWidth: 100, textAlign: "center", cursor: "pointer" }}
              >
                <option value="">More...</option>
                {metals.filter((m) => !HERO_METALS.some((h) => h.symbol === m.metal_name) && !["BTC", "ETH", "HG"].includes(m.metal_name))
                  .map((m) => (
                    <option key={m.metal_name} value={m.metal_name}>{formatMetalLabel(m)}</option>
                  ))}
              </select>
            )}
          </div>
        </section>

        {/* ─── 2. Live Ticker ───────────────────────────────── */}
        <MarketTicker metals={metals} comparisons={comparisons} />

        {/* ─── 3. Market Controls ───────────────────────────── */}
        <section className="al-market-controls">
          {isGold && (
            <div className="al-market-control-group">
              <span className="al-market-control-label">Purity</span>
              <select className="al-market-control-select" value={carat} onChange={(e) => handleSetCarat(e.target.value)}>
                {goldCarats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          )}

          <div className="al-market-control-group">
            <span className="al-market-control-label">Unit</span>
            <select className="al-market-control-select" value={unit} onChange={(e) => handleSetUnit(e.target.value)}>
              {unitOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="al-market-control-group">
            <span className="al-market-control-label">Month</span>
            <select
              className="al-market-control-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={!availableMonths.length}
            >
              {availableMonths.map((m) => <option key={m} value={m}>{dayjs(`${m}-01`).format("MMMM YYYY")}</option>)}
            </select>
          </div>
        </section>

        {/* ─── Error Banner ─────────────────────────────────── */}
        {status.error && (
          <div className="al-market-error">
            <strong>Data Unavailable</strong>
            <div>{status.error}</div>
          </div>
        )}

        {/* ─── 4. Market Statistics ─────────────────────────── */}
        <section className="al-market-stats">
          <div className="al-market-stat-card" style={{ "--stat-accent": "#e6a817" }}>
            <div className="al-market-stat-label">Daily High</div>
            <div className="al-market-stat-value">{formatMoney(weeklyStats.max)}</div>
            <div className="al-market-stat-sub">This week</div>
          </div>
          <div className="al-market-stat-card" style={{ "--stat-accent": "#4a90d9" }}>
            <div className="al-market-stat-label">Daily Low</div>
            <div className="al-market-stat-value">{formatMoney(weeklyStats.min)}</div>
            <div className="al-market-stat-sub">This week</div>
          </div>
          <div className="al-market-stat-card" style={{ "--stat-accent": changeDir === "up" ? "var(--up)" : changeDir === "down" ? "var(--down)" : "var(--neutral)" }}>
            <div className="al-market-stat-label">Weekly Change</div>
            <div className={`al-market-stat-value ${weeklyStats.last > weeklyStats.first ? "up" : weeklyStats.last < weeklyStats.first ? "down" : ""}`}>
              {weeklyStats.first ? `${((weeklyStats.last - weeklyStats.first) / weeklyStats.first * 100).toFixed(2)}%` : "—"}
            </div>
            <div className="al-market-stat-sub">{formatMoney(weeklyStats.last - weeklyStats.first)}</div>
          </div>
          <div className="al-market-stat-card" style={{ "--stat-accent": "var(--accent-2)" }}>
            <div className="al-market-stat-label">Monthly Change</div>
            <div className={`al-market-stat-value ${monthlyStats.last > monthlyStats.first ? "up" : monthlyStats.last < monthlyStats.first ? "down" : ""}`}>
              {monthlyStats.first ? `${((monthlyStats.last - monthlyStats.first) / monthlyStats.first * 100).toFixed(2)}%` : "—"}
            </div>
            <div className="al-market-stat-sub">{formatMoney(monthlyStats.last - monthlyStats.first)}</div>
          </div>
        </section>

        {/* ─── 5. Charts Section ────────────────────────────── */}
        <section className="al-market-charts">
          <div className="al-market-chart-card">
            <div className="al-market-chart-header">
              <h2 className="al-market-chart-title">
                Weekly Range{isGold ? <span className="chart-carat"> &bull; {carat}K</span> : null}
              </h2>
              <span className="al-market-chart-meta">{unit}</span>
            </div>
            {weekly.length > 0 ? (
              <Chart
                type="area"
                series={buildApexSeries(weekly)}
                options={buildApexOptions(weekly, weeklyStats, "Weekly")}
                height={280}
              />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>No weekly data available</div>
            )}
          </div>

          <div className="al-market-chart-card">
            <div className="al-market-chart-header">
              <h2 className="al-market-chart-title">
                Monthly Range{isGold ? <span className="chart-carat"> &bull; {carat}K</span> : null}
              </h2>
              <span className="al-market-chart-meta">{unit}</span>
            </div>
            {monthly.length > 0 ? (
              <Chart
                type="area"
                series={buildApexSeries(monthly)}
                options={buildApexOptions(monthly, monthlyStats, "Monthly")}
                height={280}
              />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>No monthly data available</div>
            )}
          </div>
        </section>

        {/* ─── 6. Purity Prices ─────────────────────────────── */}
        {isGold && latest?.carat_prices && (
          <section className="al-market-purity">
            <div className="al-market-purity-title">Gold Purity Prices</div>
            <div className="al-market-purity-grid">
              {goldCarats.map((c) => (
                <div key={c.value} className={`al-market-purity-item ${carat === c.value ? "active" : ""}`}>
                  <div className="al-market-purity-label">{c.label}</div>
                  <div className="al-market-purity-price">{formatMoney(latest.carat_prices[c.value] || 0)}</div>
                  <div className="al-market-purity-sub">per gram</div>
                </div>
              ))}
            </div>
            <div className="al-market-purity-meta">
              <span>Updated: {lastUpdated}</span>
              <span>Source: apised.com</span>
            </div>
          </section>
        )}

        {/* Non-gold: per kg display */}
        {!isGold && latest && (
          <section className="al-market-purity">
            <div className="al-market-purity-title">{metalLabelMap[selectedMetal] || selectedMetal} Pricing</div>
            <div className="al-market-purity-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="al-market-purity-item">
                <div className="al-market-purity-label">Per Gram</div>
                <div className="al-market-purity-price">{formatMoney(latest.price_1g || 0)}</div>
              </div>
              <div className="al-market-purity-item">
                <div className="al-market-purity-label">Per Kilogram</div>
                <div className="al-market-purity-price">{formatMoney(latest.price_per_kg || 0)}</div>
              </div>
            </div>
            <div className="al-market-purity-meta">
              <span>Updated: {lastUpdated}</span>
              <span>Source: apised.com</span>
            </div>
          </section>
        )}

        {/* ─── 7. Tools Section ─────────────────────────────── */}
        <section className="al-market-tools">
          <button className="al-market-tool-btn primary" onClick={() => setShowAlertsModal(true)}>
            <span className="al-market-tool-icon">&#9881;</span> Set Price Alert
          </button>
          <button className="al-market-tool-btn" onClick={handleExportCsv} disabled={exportLoading || !weekly.length}>
            <span className="al-market-tool-icon">&#8681;</span> Download CSV
          </button>
          <button className="al-market-tool-btn" onClick={handleExportPdf} disabled={exportLoading || !weekly.length}>
            <span className="al-market-tool-icon">&#128196;</span> {exportLoading ? "Generating..." : "Download PDF"}
          </button>
          {downloadLink && (
            <div className="al-market-download-fallback">
              <a href={downloadLink.url} download={downloadLink.filename}>Download {downloadLink.label}</a>
            </div>
          )}
        </section>

        {/* ─── 8. Market Insight (AI Summary) ───────────────── */}
        <MarketInsight
          dailySummary={dailySummary}
          summaryLoading={summaryLoading}
          summaryGenerating={summaryGenerating}
        />

        {/* ─── 9. Market Info Bar ───────────────────────────── */}
        <section className="al-market-info-bar">
          <button className="al-market-info-link" onClick={() => setShowFaq(true)}>About &amp; FAQ</button>
          <span className="al-market-info-sep">&bull;</span>
          <button className="al-market-info-link" onClick={() => setShowPrivacy(true)}>Privacy Policy</button>
        </section>

        {/* ─── Loading Overlay ──────────────────────────────── */}
        {status.loading && (
          <div className="al-market-loading" role="status" aria-live="polite">
            <div className="al-market-loading-card">
              <div className="al-market-loading-orb" />
              <div>
                <div className="al-market-loading-title">Loading Market Data</div>
                <div className="al-market-loading-text">{status.message || "Please wait..."}</div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Toast Notifications ──────────────────────────── */}
        <div className="al-market-toasts">
          {toasts.map((t) => (
            <div key={t.id} className="al-market-toast">{t.message}</div>
          ))}
        </div>

        {/* ─── Alerts Modal ─────────────────────────────────── */}
        <AlertsModal
          show={showAlertsModal}
          onClose={() => setShowAlertsModal(false)}
          metals={metals}
          alerts={alerts}
          newAlert={newAlert}
          setNewAlert={setNewAlert}
          onAddAlert={addAlert}
          onDeleteAlert={deleteAlert}
          onToggleAlert={toggleAlert}
          userEmail={userEmail}
          savedEmailMask={savedEmailMask}
          rememberEmail={rememberEmail}
          setRememberEmail={setRememberEmail}
          onSaveEmail={saveEmail}
          onRemoveEmail={removeEmail}
          emailLoading={emailLoading}
          notificationPermission={notificationPermission}
          onRequestNotificationPermission={requestNotificationPermission}
        />

        {/* ─── FAQ Modal ────────────────────────────────────── */}
        {showFaq && (
          <div className="al-market-modal-overlay" onClick={() => setShowFaq(false)}>
            <div className="al-market-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="al-market-modal-header">
                <div className="al-market-modal-header-left">
                  <img src="/metal-price-icon.svg" alt="Auric Ledger" className="al-market-modal-logo" />
                  <h2 className="al-market-modal-title">About Auric Ledger</h2>
                </div>
                <button className="al-market-modal-close" aria-label="Close" onClick={() => setShowFaq(false)}>&#x2715;</button>
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                <div className="al-market-modal-section">
                  <h3>Auric Ledger v1.1.0</h3>
                  <p>Premium Precious Metals Price Tracker. A production-ready full-stack AI-powered application for tracking real-time prices of 9 precious metals and commodities with transparent INR conversion, duty calculations, and GST applied.</p>
                </div>
                <div className="al-market-modal-section">
                  <h3>Key Features</h3>
                  <p>Real-Time Pricing, AI Daily Summary, AI Chatbot, Smart Alerts, PWA App, Telegram Bot, Analytics, Export, Email Updates, Dark Mode, Automated Cron.</p>
                </div>
                <div className="al-market-modal-section">
                  <h3>Price Calculation</h3>
                  <p>Final Price = (USD Price / 31.1035g per oz) x USD→INR Rate x 1.06 (Duty) x 1.03 (GST). Gold: 18K x0.75 | 22K x0.916 | 24K x1.0.</p>
                </div>
                <div className="al-market-modal-section">
                  <h3>Developer</h3>
                  <p>Built by <strong>Sabithulla</strong>. Version 1.1.0 | Released: February 15, 2026.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Privacy Modal ────────────────────────────────── */}
        {showPrivacy && (
          <div className="al-market-modal-overlay" onClick={() => setShowPrivacy(false)}>
            <div className="al-market-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="al-market-modal-header">
                <div className="al-market-modal-header-left">
                  <img src="/metal-price-icon.svg" alt="Auric Ledger" className="al-market-modal-logo" />
                  <h2 className="al-market-modal-title">Privacy Policy</h2>
                </div>
                <button className="al-market-modal-close" aria-label="Close" onClick={() => setShowPrivacy(false)}>&#x2715;</button>
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                <div className="al-market-modal-section">
                  <h3>Overview</h3>
                  <p>Auric Ledger respects your privacy. We collect only what is required to deliver price updates and alerts. We do not sell your data.</p>
                </div>
                <div className="al-market-modal-section">
                  <h3>Data We Collect</h3>
                  <p>Email (optional, for daily updates). Local preferences stored in your browser. Zero tracking or analytics.</p>
                </div>
                <div className="al-market-modal-section">
                  <h3>Contact</h3>
                  <p>For questions: <a href="mailto:auricledger@gmail.com" style={{ color: "var(--accent)" }}>auricledger@gmail.com</a></p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
