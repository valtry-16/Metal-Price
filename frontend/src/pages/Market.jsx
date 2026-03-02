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
import { useTheme } from "../contexts/ThemeContext";
import { PROD_API_URL, IS_DEV, goldCarats, metalLabelMap, metalThemes, METAL_ORDER } from "../utils/constants";
import {
  formatMoney, formatNumberPlain, unitsForMetal, formatMetalLabel,
  getMetalTheme, sortMetals, maskEmail, calculateChartRange,
  buildChartData, buildChartOptions, loadPdfLibs
} from "../utils/helpers";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

// Helper to detect API backend - always returns production URL
const detectApiBase = async () => {
  // Detect if on mobile device (by user agent or screen size)
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isMobileScreen = window.innerWidth <= 768 || window.screen.width <= 768;
  const isMobile = isMobileUserAgent || isMobileScreen;
  
  if (IS_DEV) {
    if (isMobile) {
      console.log("📱 Mobile device detected - Using production API:", PROD_API_URL);
    } else {
      console.log("💻 Desktop device - Using production API:", PROD_API_URL);
    }
  }
  
  return PROD_API_URL;
};

export default function Market() {
  const { darkMode, toggleDarkMode } = useTheme();

  // API Backend - always uses production
  const [apiBase, setApiBase] = useState(PROD_API_URL);
  
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
  const [metalSearch, setMetalSearch] = useState("");
  const [showFaq, setShowFaq] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [dailySummary, setDailySummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  
  // Alert system states
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [newAlert, setNewAlert] = useState({ metal: "", type: "price_threshold", direction: "below", value: "", enabled: true });
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [userEmail, setUserEmail] = useState("");
  const [savedEmailMask, setSavedEmailMask] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const isGold = useMemo(() => {
    return selectedMetal.toLowerCase().includes("gold") || selectedMetal.toLowerCase().includes("xau");
  }, [selectedMetal]);

  // Detect API backend on mount
  useEffect(() => {
    const detectBackend = async () => {
      const detectedUrl = await detectApiBase();
      setApiBase(detectedUrl);
    };
    detectBackend();
  }, []);

  // Load alerts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("auric-alerts");
    if (saved) {
      try {
        setAlerts(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load alerts:", err);
      }
    }

    // Load email subscription (masked by default, full only if user opted in)
    const savedEmail = localStorage.getItem("auric-email");
    const savedMask = localStorage.getItem("auric-email-mask");
    if (savedEmail) {
      setUserEmail(savedEmail);
      setSavedEmailMask(maskEmail(savedEmail));
      setRememberEmail(true);
    } else if (savedMask) {
      setSavedEmailMask(savedMask);
    }

    // Request notification permission
    if ("Notification" in window && Notification.permission !== "denied") {
      setNotificationPermission(Notification.permission);
    }

    // Check if daily notification has been shown today (only if browser notifications enabled)
    checkDailyNotification();
  }, []);

  // Check and show daily price notification (only once per day)
  const checkDailyNotification = async () => {
    if (notificationPermission !== "granted") return;

    const lastNotificationDate = localStorage.getItem("auric-last-daily-notification");
    const today = dayjs().format("YYYY-MM-DD");

    if (lastNotificationDate === today) {
      return; // Already shown today
    }

    try {
      const response = await fetch(`${apiBase}/daily-price-summary`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.status === "success" && data.summary?.length > 0) {
        // Show single notification with gold price
        const goldPrice = data.summary.find(m => m.metal === "XAU");
        if (goldPrice) {
          const message = `Today's Gold (22K): ₹${goldPrice.price.toFixed(2)}/g | ${data.summary.length} metals updated`;
          showNotification("Auric Ledger - Daily Update", { body: message });
          localStorage.setItem("auric-last-daily-notification", today);
        }
      }
    } catch (error) {
      console.error("Failed to fetch daily notification:", error);
    }
  };

  // Save alerts to localStorage
  const saveAlerts = (updatedAlerts) => {
    setAlerts(updatedAlerts);
    localStorage.setItem("auric-alerts", JSON.stringify(updatedAlerts));
  };

  // Save email and send to backend
  const saveEmail = async (email) => {
    if (!email || !email.includes("@")) {
      showToast("❌ Please enter a valid email");
      return;
    }

    setEmailLoading(true);
    try {
      const response = await fetch(`${apiBase}/subscribe-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error("Failed to subscribe email");
      }

      const data = await response.json();
      const masked = maskEmail(email);
      if (rememberEmail) {
        localStorage.setItem("auric-email", email);
      } else {
        localStorage.removeItem("auric-email");
      }
      localStorage.setItem("auric-email-mask", masked);
      setUserEmail(rememberEmail ? email : "");
      setSavedEmailMask(masked);
      showToast("✅ Daily price emails enabled for " + masked);
    } catch (error) {
      console.error("Email subscription error:", error);
      showToast("❌ Failed to subscribe email: " + error.message);
    } finally {
      setEmailLoading(false);
    }
  };

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === "granted";
    }
    return false;
  };

  // Show toast notification
  const showToast = (message, duration = 4000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  // Show browser notification
  const showNotification = (title, options = {}) => {
    if (notificationPermission === "granted" && "Notification" in window) {
      new Notification(title, {
        icon: "/metal-price-icon.svg",
        badge: "/metal-price-icon.svg",
        ...options
      });
    }
  };

  // Add new alert
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
      lastTriggeredAt: null
    };

    const updated = [...alerts, alert];
    saveAlerts(updated);
    setNewAlert({ metal: "", type: "price_threshold", direction: "below", value: "", enabled: true });
    showToast(`✅ Alert created for ${formatMetalLabel({ metal_name: newAlert.metal })}`);
  };

  // Delete alert
  const deleteAlert = (id) => {
    const updated = alerts.filter((a) => a.id !== id);
    saveAlerts(updated);
    showToast("🗑️ Alert deleted");
  };

  // Toggle alert
  const toggleAlert = (id) => {
    const updated = alerts.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    saveAlerts(updated);
  };

  // Check if alert should trigger
  const checkAlerts = async (metalName, currentPrice) => {
    if (!currentPrice || !alerts.length) return;

    for (const alert of alerts) {
      if (!alert.enabled || alert.metal !== metalName) continue;

      const now = new Date();
      const lastTriggered = alert.lastTriggeredAt ? new Date(alert.lastTriggeredAt) : null;
      const timeSinceLastTrigger = lastTriggered ? (now - lastTriggered) / (1000 * 60) : Infinity;

      // Prevent duplicate alerts within 60 minutes
      if (timeSinceLastTrigger < 60) continue;

      let shouldTrigger = false;
      let message = "";

      if (alert.type === "price_threshold" || alert.type === "target_price") {
        const direction = alert.direction || "below";
        if (direction === "below" && currentPrice <= alert.value) {
          shouldTrigger = true;
          message = `📉 ${formatMetalLabel({ metal_name: alert.metal })} dropped below ₹${alert.value.toFixed(2)}/g! Current: ₹${currentPrice.toFixed(2)}/g`;
        } else if (direction === "above" && currentPrice >= alert.value) {
          shouldTrigger = true;
          message = `📈 ${formatMetalLabel({ metal_name: alert.metal })} crossed above ₹${alert.value.toFixed(2)}/g! Current: ₹${currentPrice.toFixed(2)}/g`;
        }
      } else if (alert.type === "percentage_change") {
        const comparison = comparisons[metalName];
        if (comparison) {
          const oldPrice = comparison.yesterday_prices?.price_1g || 0;
          if (oldPrice > 0) {
            const pctChange = ((currentPrice - oldPrice) / oldPrice) * 100;
            if (Math.abs(pctChange) >= alert.value) {
              shouldTrigger = true;
              const direction = pctChange > 0 ? "📈 Up" : "📉 Down";
              message = `${direction} ${Math.abs(pctChange).toFixed(2)}%! ${formatMetalLabel({ metal_name: alert.metal })} ${pctChange > 0 ? "increased" : "decreased"} by ${Math.abs(pctChange).toFixed(2)}%`;
            }
          }
        }
      }

      if (shouldTrigger) {
        // Show notification (browser notification if enabled, otherwise toast)
        if (notificationPermission === "granted") {
          showNotification("Auric Ledger - Price Alert", { body: message });
        } else {
          showToast(message);
        }

        // Send email notification if user has subscribed
        if (userEmail) {
          try {
            await fetch(`${apiBase}/trigger-price-alert`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: userEmail,
                metalName: alert.metal,
                currentPrice: currentPrice,
                alertType: alert.type,
                alertDirection: alert.direction || "below",
                targetValue: alert.value,
                browserNotificationEnabled: notificationPermission === "granted"
              })
            });
          } catch (error) {
            console.error("Failed to send email alert:", error);
          }
        }

        // Update last triggered time
        const updated = alerts.map((a) =>
          a.id === alert.id ? { ...a, lastTriggeredAt: now.toISOString() } : a
        );
        saveAlerts(updated);
      }
    }
  };

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
        const response = await fetch(`${apiBase}/get-latest-price`);
        setStatus({ loading: true, error: "", message: "Loading available metals..." });
        if (!response.ok) throw new Error("Unable to fetch available metals. Please check your internet connection.");
        const data = await response.json();
        const filteredMetals = sortMetals((data.metals || []).filter(m => !['BTC', 'ETH', 'HG'].includes(m.metal_name)));
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

          // Show notification with today's gold price
          const goldMetal = filteredMetals.find(m => m.metal_name === "XAU");
          if (goldMetal) {
            try {
              const goldPriceRes = await fetch(`${apiBase}/get-latest-price?metal=XAU&carat=22`);
              if (goldPriceRes.ok) {
                const goldData = await goldPriceRes.json();
                if (goldData.latest?.price_1g) {
                  const priceFormatted = new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0
                  }).format(goldData.latest.price_1g);
                  showToast(`🏆 Today's Gold Price (22K, 1g) - ${priceFormatted}`);
                }
              }
            } catch (err) {
              // Silent fail - notification is optional
            }
          }
        }
      } catch (error) {
        setStatus({ loading: false, error: error.message, message: "" });
      }
    };
    load();
  }, []);

  // Fetch daily AI summary on mount + listen for real-time SSE updates
  useEffect(() => {
    // Initial fetch
    setSummaryLoading(true);
    fetch(`${apiBase}/daily-summary`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.summary) setDailySummary({ date: data.date, summary: data.summary });
        if (data?.generating) setSummaryGenerating(true);
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));

    // SSE — real-time push from backend (no polling needed)
    let es;
    try {
      es = new EventSource(`${apiBase}/summary-events`);

      es.addEventListener("connected", (e) => {
        const d = JSON.parse(e.data);
        if (d.generating) setSummaryGenerating(true);
      });

      es.addEventListener("generating", () => {
        setSummaryGenerating(true);
      });

      es.addEventListener("complete", (e) => {
        const d = JSON.parse(e.data);
        setSummaryGenerating(false);
        if (d.summary) setDailySummary({ date: d.date, summary: d.summary });
      });

      es.addEventListener("error", () => {
        setSummaryGenerating(false);
      });
    } catch {
      // SSE not supported — silent fail, initial fetch is sufficient
    }

    return () => { if (es) es.close(); };
  }, []);

  useEffect(() => {
    if (!selectedMetal) return;
    const loadDetails = async () => {
      try {
        setStatus({ loading: true, error: "", message: "Fetching latest prices..." });
        setDownloadLink(null);
        const caratParam = isGold ? `&carat=${carat}` : "";
        const [latestRes, compareRes, weeklyRes, monthlyRes] = await Promise.all([
          fetch(`${apiBase}/get-latest-price?metal=${encodeURIComponent(selectedMetal)}${caratParam}`),
          fetch(`${apiBase}/compare-yesterday?metal=${encodeURIComponent(selectedMetal)}${caratParam}`),
          fetch(`${apiBase}/weekly-history?metal=${encodeURIComponent(selectedMetal)}${caratParam}`),
          fetch(`${apiBase}/monthly-history?metal=${encodeURIComponent(selectedMetal)}${caratParam}`)
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

        // Fetch comparisons for ALL metals (defer to idle time for better performance)
        if (metals && metals.length > 0) {
          const scheduleIdle = (callback) => {
            if (typeof window !== "undefined" && "requestIdleCallback" in window) {
              window.requestIdleCallback(callback, { timeout: 1500 });
            } else {
              setTimeout(callback, 0);
            }
          };

          scheduleIdle(() => {
            (async () => {
              setStatus({ loading: true, error: "", message: "Loading all metal comparisons..." });
              const allComparisons = {};
              const comparePromises = metals
                .filter(m => !['BTC', 'ETH', 'HG'].includes(m.metal_name))
                .map(async (metal) => {
                  try {
                    // Always use 22K for gold in ticker, no carat param for other metals
                    const metalCaratParam = metal.metal_name.toLowerCase().includes("gold") || metal.metal_name.toLowerCase().includes("xau") ? "&carat=22" : "";
                    const res = await fetch(
                      `${apiBase}/compare-yesterday?metal=${encodeURIComponent(metal.metal_name)}${metalCaratParam}`
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
              setStatus({ loading: false, error: "", message: "" });
            })();
          });
        }
        if (!metals || metals.length === 0) {
          setStatus({ loading: false, error: "", message: "" });
        }

        // Check alerts after all data is loaded
        if (latestData?.latest?.price_1g) {
          checkAlerts(selectedMetal, latestData.latest.price_1g);
        }
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
          `${apiBase}/monthly-history?metal=${encodeURIComponent(selectedMetal)}${caratParam}&month=${selectedMonth}`
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

  const chartSeries = useMemo(
    () => [
      {
        label: unit,
        key: selectedPriceKey,
        color: metalTheme.primary,
        fillColor: metalTheme.light
      }
    ],
    [unit, selectedPriceKey, metalTheme.primary, metalTheme.light]
  );

  const allChartValues = useMemo(
    () => [...weekly, ...monthly]
      .map((p) => p[selectedPriceKey])
      .filter(Number.isFinite),
    [weekly, monthly, selectedPriceKey]
  );
  const chartRange = useMemo(() => calculateChartRange(allChartValues), [allChartValues]);
  const chartOptions = useMemo(() => buildChartOptions(chartRange), [chartRange]);
  const weeklyChartData = useMemo(() => buildChartData(weekly, chartSeries), [weekly, chartSeries]);
  const monthlyChartData = useMemo(() => buildChartData(monthly, chartSeries), [monthly, chartSeries]);

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

  const handleExportPdf = async () => {
    if (!weekly.length) {
      setStatus({ loading: false, error: "No data available", message: "" });
      return;
    }
    
    try {
      setExportLoading(true);
      setStatus({ loading: false, error: "", message: "Generating PDF..." });
      
      const { jsPDF } = await loadPdfLibs();
      const rows = buildExportRows();
      const stats = getWeeklyStats();
      const dateRange = {
        start: dayjs(weekly[0].date).format("DD MMM YYYY"),
        end: dayjs(weekly[weekly.length - 1].date).format("DD MMM YYYY")
      };
      
      // Load and convert logo SVG to PNG for PDF embedding (CSP-safe, no blob URLs)
      const convertSvgToPng = async () => {
        try {
          const response = await fetch("/metal-price-icon.svg");
          if (!response.ok) return null;
          
          const svgText = await response.text();
          return new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            canvas.width = 72;
            canvas.height = 72;
            const ctx = canvas.getContext("2d");
            
            // Encode SVG as data URL (no blob URLs to avoid CSP violation)
            const encoded = encodeURIComponent(svgText);
            const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
            const img = new Image();
            
            img.onload = () => {
              ctx.drawImage(img, 0, 0, 72, 72);
              const pngUrl = canvas.toDataURL("image/png");
              resolve(pngUrl);
            };
            
            img.onerror = () => {
              console.warn("Failed to load SVG image");
              resolve(null);
            };
            
            img.src = svgDataUrl;
            
            // Timeout fallback
            setTimeout(() => {
              resolve(null);
            }, 3000);
          });
        } catch (e) {
          console.warn("Could not convert logo SVG to PNG", e);
          return null;
        }
      };
      
      const logoPngUrl = await convertSvgToPng();
      
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
      
      // Add logo (prefer actual logo, fallback to AL circle)
      if (logoPngUrl) {
        try {
          doc.addImage(logoPngUrl, "PNG", 32, 22, 36, 36);
        } catch (e) {
          console.warn("Could not add logo image to PDF, using fallback");
          doc.setFillColor(...accentColor);
          doc.circle(48, 40, 14, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(255, 255, 255);
          doc.text("AL", 43, 43);
        }
      } else {
        // Fallback: AL circle
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
      doc.text("Auric Ledger Report", 40, 115);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...mutedColor);
      doc.text("https://auric-ledger.vercel.app/", 40, 130);
      
      // Content section with better spacing
      const contentY = 150;
      doc.setFontSize(11);
      doc.setTextColor(...textColor);
      doc.setFont("helvetica", "normal");
      
      const infoLines = [
        `Metal: ${formatMetalLabel({ metal_name: selectedMetal, display_name: metalLabelMap[selectedMetal] || null })}${isGold ? ` (${carat}K)` : ""}`,
        `Unit: ${unit}`,
        `Date Range: ${dateRange.start} to ${dateRange.end}`,
        `Last Updated: ${lastUpdated}`,
        `Generated: ${dayjs().format("DD MMM YYYY, HH:mm")}`
      ];
      
      let currentY = contentY;
      infoLines.forEach((line) => {
        doc.text(line, 40, currentY);
        currentY += 16;
      });

      // 7-Day Summary Section
      currentY += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...textColor);
      doc.text("7-Day Summary", 40, currentY);
      
      currentY += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const summaryLines = [
        `Low: ${formatNumberPlain(stats.min)}`,
        `High: ${formatNumberPlain(stats.max)}`,
        `Average: ${formatNumberPlain(stats.avg)}`
      ];
      
      summaryLines.forEach((line) => {
        doc.text(line, 40, currentY);
        currentY += 16;
      });

      if (unitComparison) {
        doc.text(
          `Change vs Yesterday: ${formatNumberPlain(unitComparison.difference)} (${unitComparison.percentage_change.toFixed(2)}%)`,
          40,
          currentY
        );
        currentY += 16;
      }

      currentY += 8;
      const pdfRows = weekly.map((entry) => [
        dayjs(entry.date).format("DD MMM YYYY"),
        `${formatMetalLabel({ metal_name: selectedMetal, display_name: metalLabelMap[selectedMetal] || null })}${
          isGold ? ` (${carat}K)` : ""
        }`,
        unit,
        formatNumberPlain(entry[selectedPriceKey] || 0)
      ]);

      doc.autoTable({
        startY: currentY,
        head: [["Date", "Metal", "Unit", "Price (Rs.)"]],
        body: pdfRows,
        theme: "grid",
        headStyles: {
          fillColor: tableHeadBg,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "left",
          fontSize: 11
        },
        styles: {
          font: "helvetica",
          fontSize: 10,
          cellPadding: 8,
          textColor: tableTextColor,
          fillColor: bgColor,
          lineColor: 180
        },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "left" },
          2: { halign: "center" },
          3: { halign: "right" }
        },
        alternateRowStyles: { fillColor: tableAltRowBg },
        margin: { left: 40, right: 40 }
      });

      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(9);
      doc.setTextColor(...mutedColor);
      doc.text("Auric Ledger • https://auric-ledger.vercel.app/", 40, 820);
      doc.text(`Page 1 of ${pageCount}`, 520, 820);

      // Generate PDF blob (same logic as CSV)
      const filename = `metal-prices-${selectedMetal}-${unit}-${dayjs().format("YYYYMMDD")}.pdf`;
      const pdfBlob = doc.output("blob");
      
      if (!pdfBlob || pdfBlob.size === 0) {
        throw new Error("Failed to generate PDF");
      }
      
      // Revoke previous blob if exists (cleanup)
      if (downloadLink?.url) {
        URL.revokeObjectURL(downloadLink.url);
      }
      
      // Create object URL and trigger download immediately (same as CSV)
      const url = URL.createObjectURL(pdfBlob);
      setDownloadLink({ url, filename, label: "PDF" });
      
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      
      setStatus({ loading: false, error: "", message: "✅ PDF downloaded successfully!" });
      setExportLoading(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setStatus({ loading: false, error: "", message: "" });
      }, 3000);
      
    } catch (error) {
      console.error("PDF export error:", error);
      setStatus({ loading: false, error: `❌ PDF failed: ${error.message}`, message: "" });
      setExportLoading(false);
    }
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
    <div className="market-page">
      <div className="shell">
        <header className="hero">
          <div className="hero__left">
            <p className="hero__tagline">
              Beautifully simple pricing insights, updated in real time.
            </p>
            {(dailySummary || summaryLoading || summaryGenerating) && (
              <div className="hero__summary">
                <div className="hero__summary-inner">
                  <div className="hero__summary-header">
                    <h3>Daily Market Summary</h3>
                    {dailySummary && !summaryGenerating && <span className="hero__summary-date">{dailySummary.date}</span>}
                    {summaryGenerating && <span className="hero__summary-loading">Generating…</span>}
                    {summaryLoading && !summaryGenerating && <span className="hero__summary-loading">Updating…</span>}
                  </div>
                  {summaryGenerating ? (
                    <div className="summary-generating-loader">
                      <div className="summary-orb"></div>
                      <p className="summary-gen-text">Generating Today's Summary</p>
                      <p className="summary-gen-sub">Please wait…</p>
                    </div>
                  ) : summaryLoading ? (
                    <div className="hero__summary-body summary-skeleton">
                      <div className="skeleton-line w80" />
                      <div className="skeleton-line w60" />
                      <div className="skeleton-line w90" />
                      <div className="skeleton-line w70" />
                      <div className="skeleton-line w85" />
                      <div className="skeleton-line w50" />
                      <div className="skeleton-line w75" />
                      <div className="skeleton-line w65" />
                    </div>
                  ) : (
                    <div className="hero__summary-body">
                      {dailySummary.summary.split("\n").map((line, i) => {
                        if (!line.trim()) return <div key={i} className="summary-spacer" />;
                        const parts = line.split(/(\*\*[^*]+\*\*)/).map((seg, j) => {
                          if (seg.startsWith("**") && seg.endsWith("**")) {
                            return <strong key={j}>{seg.slice(2, -2)}</strong>;
                          }
                          return seg;
                        });
                        const isHeading = /^(Market Overview|Outlook)[:\s]/i.test(line.trim());
                        const isMetalLine = line.includes("₹") && (/\/g|\/kg|per gram|per kg|per 8g/i.test(line));
                        return (
                          <p key={i} className={isHeading ? "summary-heading" : isMetalLine ? "summary-metal" : ""}>
                            {parts}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
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
                {sortMetals(metals.filter(m => !['BTC', 'ETH', 'HG'].includes(m.metal_name)))
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
                      <span key={metal.metal_name} className={`ticker-item ${direction}`} style={{ color: direction === "up" ? "var(--up)" : direction === "down" ? "var(--down)" : theme.primary }}>
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
            <span>Source: apised.com</span>
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
            <button className="export-btn" type="button" onClick={handleExportCsv} disabled={exportLoading}>
              Download CSV
            </button>
            <button className="export-btn" type="button" onClick={handleExportPdf} disabled={exportLoading}>
              {exportLoading ? "⏳ Generating..." : "Download PDF"}
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
            <Line data={weeklyChartData} options={chartOptions} />
          </div>
          <div className="chart-panel">
            <div className="chart-title">
              <h2>
                Monthly Range{isGold ? <span className="chart-carat"> • {carat}K</span> : null}
              </h2>
              <span className="chart-meta">{unit}</span>
            </div>
            <Line data={monthlyChartData} options={chartOptions} />
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
                  <h2>About Auric Ledger</h2>
                </div>
                <button className="modal-close" onClick={() => setShowFaq(false)}>
                  ✕
                </button>
              </div>
              <div className="faq-section">
                <div className="faq-item">
                  <h3>🚀 Auric Ledger v1.1.0</h3>
                  <p>
                    <strong>Premium Precious Metals Price Tracker</strong><br/>
                    A production-ready full-stack AI-powered application for tracking real-time prices of 9 precious metals and commodities 
                    with transparent INR conversion, duty calculations, and GST applied. Now featuring AI daily market summaries, 
                    an intelligent chatbot, and smart threshold-based price alerts. Built for serious traders and investors.
                  </p>
                </div>
                
                <div className="faq-item">
                  <h3>✨ Key Features</h3>
                  <p>
                    <strong style={{ color: "var(--accent)" }}>📊 Real-Time Pricing:</strong> Live prices for Gold, Silver, Platinum, Palladium, 
                    Copper, Nickel, Zinc, Aluminium, and Lead converted to INR with duty (6%) and GST (3%)<br/>
                    <strong style={{ color: "var(--accent)" }}>🧠 AI Daily Summary:</strong> Auto-generated AI market analysis each day with key insights, trends, and recommendations<br/>
                    <strong style={{ color: "var(--accent)" }}>💬 AI Chatbot (Auric AI):</strong> Ask questions about metals, prices, and market trends — powered by a custom AI model<br/>
                    <strong style={{ color: "var(--accent)" }}>🔔 Smart Alerts:</strong> Set price thresholds — get notified via browser + email when prices cross above or below your limit<br/>
                    <strong style={{ color: "var(--accent)" }}>📱 PWA App:</strong> Install as native app on desktop, Android, and iOS. Works offline with automatic sync<br/>
                    <strong style={{ color: "var(--accent)" }}>🤖 Telegram Bot:</strong> Get prices, charts, summaries, AI chat, and daily updates via Telegram bot with 9 powerful commands<br/>
                    <strong style={{ color: "var(--accent)" }}>📈 Analytics:</strong> 7-day weekly trends and monthly historical data with interactive charts<br/>
                    <strong style={{ color: "var(--accent)" }}>💾 Export:</strong> Download CSV data or premium PDF reports with price breakdowns<br/>
                    <strong style={{ color: "var(--accent)" }}>📧 Email Updates:</strong> Subscribe for daily prices with a welcome email sent within minutes<br/>
                    <strong style={{ color: "var(--accent)" }}>🌙 Dark Mode:</strong> Eye-friendly dark theme with persistent preferences<br/>
                    <strong style={{ color: "var(--accent)" }}>⚡ Automated:</strong> Daily cron job at 9:00 AM IST for price updates and AI summary generation
                  </p>
                </div>

                <div className="faq-item">
                  <h3>🤖 Telegram Bot Features</h3>
                  <p>
                    <strong style={{ color: "var(--accent)" }}>📱 Instant Prices:</strong> Get current and yesterday's prices for all 9 metals on demand<br/>
                    <strong style={{ color: "var(--accent)" }}>📊 Smart Charts:</strong> View 7-day, 30-day, or custom month charts for any metal<br/>
                    <strong style={{ color: "var(--accent)" }}>🧠 AI Summary:</strong> Get the daily AI-generated market summary via /summary command<br/>
                    <strong style={{ color: "var(--accent)" }}>💬 AI Chat:</strong> Ask the AI about metals and prices via /ask command<br/>
                    <strong style={{ color: "var(--accent)" }}>🔔 Daily Updates:</strong> Subscribe to automatic 9 AM price updates with change indicators (↑↓)<br/>
                    <strong style={{ color: "var(--accent)" }}>🎨 Color-Coded:</strong> Each metal has unique color emoji for quick visual identification<br/>
                    <strong style={{ color: "var(--accent)" }}>💹 Price Changes:</strong> Daily updates show exact price changes and percentages from yesterday<br/><br/>
                    <strong>Commands:</strong> /start, /prices, /yesterday, /summary, /chart, /download, /ask, /subscribe, /unsubscribe<br/>
                    <strong>Bot Link:</strong> <a href="https://t.me/AuricLedgerBot" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>t.me/AuricLedgerBot</a>
                  </p>
                </div>

                <div className="faq-item">
                  <h3>🏗️ Technical Stack</h3>
                  <p>
                    <strong>Frontend:</strong> React 19 + Vite with jsPDF for report generation, Chart.js for analytics<br/>
                    <strong>Backend:</strong> Node.js + Express with cron scheduling and rate limiting<br/>
                    <strong>Database:</strong> Supabase (PostgreSQL) for reliable data persistence<br/>
                    <strong>API:</strong> apised.com Metals API for 9 metal prices + frankfurter.app for USD↔INR conversion<br/>
                    <strong>PWA:</strong> Service Workers for offline caching and app installation capability
                  </p>
                </div>

                <div className="faq-item">
                  <h3>🎯 What We've Accomplished</h3>
                  <p>
                    ✅ Migrated from gold-api.com to apised.com for broader metal coverage<br/>
                    ✅ Implemented all 9 metal symbols with proper naming and color themes<br/>
                    ✅ Built cron pipelines with external scheduling and secure secrets<br/>
                    ✅ Created PWA with service worker for offline functionality and installable app<br/>
                    ✅ Generated 8 app icons (72px to 512px) for all device types<br/>
                    ✅ Fixed notification ticker with proper metal ordering and comparisons<br/>
                    ✅ Added dark/light theme toggle with localStorage persistence<br/>
                    ✅ Built comprehensive PDF & CSV export functionality<br/>
                    ✅ Implemented responsive mobile design with hamburger menu<br/>
                    ✅ Added detailed About + Privacy pages with updated policies<br/>
                    ✅ Integrated Telegram bot with 9 commands including /summary and /ask<br/>
                    ✅ Built interactive chart system (7-day, 30-day, custom month)<br/>
                    ✅ Added price change tracking with color-coded indicators<br/>
                    ✅ Added welcome emails with retry-safe background delivery<br/>
                    ✅ Hardened security with CORS, rate limits, CSP, and data masking<br/>
                    ✅ Built AI daily market summary with auto-generation and real-time SSE updates<br/>
                    ✅ Integrated Auric AI chatbot with streaming responses and RAG knowledge base<br/>
                    ✅ Revamped alert system with threshold-based price crossing detection
                  </p>
                </div>

                <div className="faq-item">
                  <h3>💰 Price Calculation Formula</h3>
                  <p>
                    <strong>Base Formula:</strong><br/>
                    Final Price = (USD Price ÷ 31.1035g/oz) × USD→INR Rate × 1.06 (Duty) × 1.03 (GST)<br/><br/>
                    <strong>Gold Purity Multipliers:</strong><br/>
                    18 Carat: ×0.75 | 22 Carat: ×0.916 | 24 Carat: ×1.0<br/><br/>
                    <strong>Data Sources:</strong><br/>
                    Metal Prices: apised.com | Exchange Rate: frankfurter.app | Storage: Supabase PostgreSQL
                  </p>
                </div>

                <div className="faq-item">
                  <h3>📊 Supported Metals</h3>
                  <p>
                    <strong style={{ color: "var(--accent)" }}>XAU</strong> - Gold (18K, 22K, 24K carats)<br/>
                    <strong style={{ color: "var(--accent)" }}>XAG</strong> - Silver<br/>
                    <strong style={{ color: "var(--accent)" }}>XPT</strong> - Platinum<br/>
                    <strong style={{ color: "var(--accent)" }}>XPD</strong> - Palladium<br/>
                    <strong style={{ color: "var(--accent)" }}>XCU</strong> - Copper<br/>
                    <strong style={{ color: "var(--accent)" }}>NI</strong> - Nickel<br/>
                    <strong style={{ color: "var(--accent)" }}>ZNC</strong> - Zinc<br/>
                    <strong style={{ color: "var(--accent)" }}>ALU</strong> - Aluminium<br/>
                    <strong style={{ color: "var(--accent)" }}>LEAD</strong> - Lead
                  </p>
                </div>

                <div className="faq-item">
                  <h3>⏰ Update Schedule</h3>
                  <p>
                    <strong>Daily Fetch:</strong> 9:00 AM IST via automated cron job<br/>
                    <strong>Manual Update:</strong> Fetch latest prices on demand via /fetch-today-prices endpoint<br/>
                    <strong>Update Interval:</strong> Minimum 15 minutes between sequential fetches to prevent API rate limiting<br/>
                    <strong>Logging:</strong> Detailed logs show all processed metals, prices, and any errors
                  </p>
                </div>

                <div className="faq-item">
                  <h3>🔒 Privacy & Security</h3>
                  <p>
                    Your preferences (theme, selected metal, units, alerts) are stored locally in your browser<br/>
                    Email subscription status is shown with a masked address unless you opt in to remember it<br/>
                    Zero tracking or analytics on user behavior<br/>
                    HTTPS-only for all sensitive data transmission with strict security headers<br/>
                    Rate limiting and input validation protect against abuse
                  </p>
                </div>

                <div className="faq-item">
                  <h3>📱 Installation Guide</h3>
                  <p>
                    <strong>Desktop (Chrome/Edge/Firefox):</strong> Click install button in address bar<br/>
                    <strong>Android Chrome:</strong> Menu → "Add to Home screen"<br/>
                    <strong>iOS Safari:</strong> Share → "Add to Home Screen"<br/>
                    Once installed, open app in standalone window with no browser UI
                  </p>
                </div>

                <div className="faq-item">
                  <h3>👨‍💻 Developer</h3>
                  <p>
                    <strong>Built by: Sabithulla</strong><br/>
                    A full-stack developer passionate about financial technology and data visualization<br/>
                    Version 1.1.0 | Released: February 15, 2026<br/>
                    <em style={{ color: "var(--muted)" }}>Built with precision for serious precious metals traders and investors</em>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showPrivacy ? (
          <div className="modal-overlay" onClick={() => setShowPrivacy(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <img src="/metal-price-icon.svg" alt="Auric Ledger" style={{ width: "36px", height: "36px" }} />
                  <h2>Privacy Policy</h2>
                </div>
                <button className="modal-close" onClick={() => setShowPrivacy(false)}>
                  ✕
                </button>
              </div>
              <div className="faq-section">
                <div className="faq-item">
                  <h3>🔐 Overview</h3>
                  <p>
                    Auric Ledger respects your privacy. We collect only what is required to deliver price updates and alerts.
                    We do not sell your data or share it for advertising.
                  </p>
                </div>

                <div className="faq-item">
                  <h3>📋 Data We Collect</h3>
                  <p>
                    <strong>Email (optional):</strong> Only if you subscribe to daily emails or price alerts. Stored securely on our server to send updates.<br/>
                    <strong>Local Preferences:</strong> Theme, selected metal, units, and alert settings stored locally in your browser.<br/>
                    <strong>AI Chat Messages:</strong> Questions sent to Auric AI are processed in real-time and not stored permanently on our servers.<br/>
                    <strong>Masked Email (local):</strong> Saved locally to show you that emails are enabled. Full email is saved only if you opt in to "Remember my email."
                  </p>
                </div>

                <div className="faq-item">
                  <h3>🔒 How We Use Your Data</h3>
                  <p>
                    <strong>Daily Emails:</strong> Used only to deliver metal price updates.<br/>
                    <strong>Price Alerts:</strong> Alert configurations are stored locally in your browser. Email alerts are sent only if you provide your email.<br/>
                    <strong>AI Summary:</strong> Daily AI-generated market summaries are stored in our database and served to all users.<br/>
                    <strong>SSE Connection:</strong> A Server-Sent Events connection is maintained for real-time summary generation updates. No personal data is transmitted.
                  </p>
                </div>

                <div className="faq-item">
                  <h3>🧠 Local Storage</h3>
                  <p>
                    We use localStorage to save your preferences (theme, filters, alerts). You can clear these at any time by removing site data in your browser.
                    The masked email display is stored locally to help you remember your subscription status.
                  </p>
                </div>

                <div className="faq-item">
                  <h3>🌐 Third-Party Services</h3>
                  <p>
                    <strong>Metals API:</strong> Price data is fetched from apised.com.<br/>
                    <strong>Exchange Rates:</strong> USD to INR rates from frankfurter.app.<br/>
                    <strong>Email Delivery:</strong> Brevo API for sending subscription and alert emails.<br/>
                    <strong>AI Model:</strong> Custom Auric AI model hosted on Hugging Face for chatbot and daily summaries.<br/>
                    <strong>Database:</strong> Supabase (PostgreSQL) stores subscription emails and daily summaries securely.<br/>
                    <strong>Telegram:</strong> If you opt in, your Telegram chat ID is used for bot updates.
                  </p>
                </div>

                <div className="faq-item">
                  <h3>🛡️ Security Practices</h3>
                  <p>
                    HTTPS is enforced for all data transmission. We apply rate limiting, input validation, and security headers to prevent abuse.
                    Sensitive data is masked in logs and never exposed to the frontend.
                  </p>
                </div>

                <div className="faq-item">
                  <h3>🧹 Data Retention & Deletion</h3>
                  <p>
                    You can unsubscribe at any time. When you remove your email in the app, it clears local storage and you can request deletion from our database.
                    We do not retain unnecessary data beyond service delivery.
                  </p>
                </div>

                <div className="faq-item">
                  <h3>📞 Contact</h3>
                  <p>
                    For privacy questions or deletion requests, contact the developer: <strong>Sabithulla</strong>.<br/>
                    Email: <a href="mailto:auricledger@gmail.com" style={{ color: "var(--accent)", textDecoration: "underline" }}>auricledger@gmail.com</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Summary Modal */}
        {showSummary ? (
          <div className="modal-overlay" onClick={() => setShowSummary(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <img src="/metal-price-icon.svg" alt="Auric Ledger" style={{ width: "36px", height: "36px" }} />
                  <h2>Daily Market Summary</h2>
                </div>
                <button className="modal-close" onClick={() => setShowSummary(false)}>
                  ✕
                </button>
              </div>
              <div className="faq-section">
                {summaryGenerating ? (
                  <div className="faq-item">
                    <div className="summary-generating-loader">
                      <div className="summary-orb"></div>
                      <p className="summary-gen-text">Generating Today's Summary</p>
                      <p className="summary-gen-sub">Please wait…</p>
                    </div>
                  </div>
                ) : summaryLoading ? (
                  <div className="faq-item">
                    <div className="summary-skeleton">
                      <div className="skeleton-line w80" />
                      <div className="skeleton-line w60" />
                      <div className="skeleton-line w90" />
                      <div className="skeleton-line w70" />
                      <div className="skeleton-line w85" />
                      <div className="skeleton-line w50" />
                      <div className="skeleton-line w75" />
                      <div className="skeleton-line w65" />
                    </div>
                    <p style={{ color: "var(--muted)", textAlign: "center", marginTop: "16px", fontSize: "13px" }}>
                      Generating today's summary…
                    </p>
                  </div>
                ) : dailySummary ? (
                  <div className="faq-item">
                    <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
                      {dailySummary.date}
                    </p>
                    <div className="summary-modal-body">
                      {dailySummary.summary.split("\n").map((line, i) => {
                        if (!line.trim()) return <div key={i} className="summary-spacer" />;
                        const parts = line.split(/(\*\*[^*]+\*\*)/).map((seg, j) => {
                          if (seg.startsWith("**") && seg.endsWith("**")) {
                            return <strong key={j}>{seg.slice(2, -2)}</strong>;
                          }
                          return seg;
                        });
                        const isHeading = /^(Market Overview|Outlook)[:\s]/i.test(line.trim());
                        const isMetalLine = line.includes("₹") && (/\/g|\/kg|per gram|per kg|per 8g/i.test(line));
                        return (
                          <p key={i} className={isHeading ? "summary-heading" : isMetalLine ? "summary-metal" : ""}>
                            {parts}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="faq-item">
                    <p style={{ color: "var(--muted)", textAlign: "center" }}>
                      No summary available yet. The daily summary is generated at 9:01 AM IST.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Toast Notifications */}
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className="toast">
              {toast.message}
            </div>
          ))}
        </div>

        {/* Alerts Modal */}
        {showAlertsModal ? (
          <div className="modal-overlay" onClick={() => setShowAlertsModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <img src="/metal-price-icon.svg" alt="Auric Ledger" style={{ width: "36px", height: "36px" }} />
                  <h2>Price Alerts</h2>
                </div>
                <button className="modal-close" onClick={() => setShowAlertsModal(false)}>
                  ✕
                </button>
              </div>
              <div className="faq-section">
                <div className="faq-item">
                  <h3>📌 Create New Alert</h3>
                  <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Select Metal</label>
                      <select
                        value={newAlert.metal}
                        onChange={(e) => setNewAlert({ ...newAlert, metal: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: "8px",
                          background: "var(--panel)",
                          color: "var(--panel-ink)",
                          fontSize: "14px"
                        }}
                      >
                        <option value="">Choose a metal...</option>
                        {metals
                          .filter(m => !['BTC', 'ETH', 'HG'].includes(m.metal_name))
                          .map((metal) => (
                            <option key={metal.metal_name} value={metal.metal_name}>
                              {formatMetalLabel(metal)}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Alert Type</label>
                      <select
                        value={newAlert.type}
                        onChange={(e) => setNewAlert({ ...newAlert, type: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: "8px",
                          background: "var(--panel)",
                          color: "var(--panel-ink)",
                          fontSize: "14px"
                        }}
                      >
                        <option value="price_threshold">📊 Price Threshold (₹/g)</option>
                        <option value="percentage_change">📈 Price Change (%)</option>
                      </select>
                    </div>
                    {newAlert.type === "price_threshold" && (
                      <div>
                        <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>Alert When Price Goes</label>
                        <select
                          value={newAlert.direction}
                          onChange={(e) => setNewAlert({ ...newAlert, direction: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "1px solid var(--line)",
                            borderRadius: "8px",
                            background: "var(--panel)",
                            color: "var(--panel-ink)",
                            fontSize: "14px"
                          }}
                        >
                          <option value="below">⬇️ Below this price</option>
                          <option value="above">⬆️ Above this price</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                        {newAlert.type === "price_threshold" ? "Threshold Price in ₹/g" : "Percentage Change (%)"}
                      </label>
                      <input
                        type="number"
                        placeholder={newAlert.type === "price_threshold" ? "e.g., 7500" : "e.g., 2.5"}
                        value={newAlert.value}
                        onChange={(e) => setNewAlert({ ...newAlert, value: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: "8px",
                          background: "var(--panel)",
                          color: "var(--panel-ink)",
                          fontSize: "14px"
                        }}
                      />
                    </div>
                    <button
                      onClick={addAlert}
                      style={{
                        padding: "10px 16px",
                        background: "var(--accent)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "14px"
                      }}
                    >
                      ➕ Create Alert
                    </button>
                    {notificationPermission !== "granted" && (
                      <button
                        onClick={requestNotificationPermission}
                        style={{
                          padding: "10px 16px",
                          background: "var(--accent-2)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: "600",
                          fontSize: "14px"
                        }}
                      >
                        Enable Notifications
                      </button>
                    )}
                  </div>
                </div>

                <div className="faq-item">
                  <h3>📧 Daily Email Notifications</h3>
                  <p style={{ marginBottom: "12px" }}>Get daily price updates for all metals at your email</p>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {userEmail || savedEmailMask ? (
                      <div style={{
                        padding: "12px",
                        background: "rgba(42, 107, 95, 0.1)",
                        border: "2px solid var(--accent-2)",
                        borderRadius: "8px",
                        color: "var(--panel-ink)"
                      }}>
                        <p style={{ margin: 0, fontSize: "14px" }}>
                          ✅ Emails enabled for: <strong>{userEmail || savedEmailMask}</strong>
                        </p>
                        {!userEmail && savedEmailMask && (
                          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                            Saved as masked email for privacy. Enable remember to store full email on this device.
                          </p>
                        )}
                        <button
                          onClick={() => {
                            setUserEmail("");
                            setSavedEmailMask("");
                            setRememberEmail(false);
                            showToast("📧 Email notifications disabled");
                            localStorage.removeItem("auric-email");
                            localStorage.removeItem("auric-email-mask");
                          }}
                          style={{
                            marginTop: "8px",
                            padding: "6px 12px",
                            background: "#b02b2b",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600"
                          }}
                        >
                          Remove Email
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "8px" }}>
                        <input
                          type="email"
                          placeholder="your.email@example.com"
                          defaultValue=""
                          id="email-input"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "1px solid var(--line)",
                            borderRadius: "8px",
                            background: "var(--panel)",
                            color: "var(--panel-ink)",
                            fontSize: "14px"
                          }}
                        />
                        <button
                          onClick={() => {
                            const email = document.getElementById("email-input").value;
                            saveEmail(email);
                          }}
                          disabled={emailLoading}
                          style={{
                            padding: "8px 16px",
                            background: emailLoading ? "var(--muted)" : "var(--accent-2)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            cursor: emailLoading ? "not-allowed" : "pointer",
                            fontWeight: "600",
                            fontSize: "14px"
                          }}
                        >
                          {emailLoading ? "⏳ Subscribing..." : "📧 Subscribe to Daily Emails"}
                        </button>
                        <label style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "12px", color: "var(--muted)" }}>
                          <input
                            type="checkbox"
                            checked={rememberEmail}
                            onChange={(event) => setRememberEmail(event.target.checked)}
                          />
                          Remember my email on this device
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="faq-item">
                  <h3>🤖 Telegram Bot Notifications</h3>
                  <p style={{ marginBottom: "12px" }}>Get instant updates and interactive charts via Telegram</p>
                  <div style={{
                    padding: "12px",
                    background: "rgba(42, 107, 95, 0.1)",
                    border: "2px solid var(--accent-2)",
                    borderRadius: "8px"
                  }}>
                    <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: "var(--panel-ink)" }}>
                      💬 Chat with our bot for prices, charts, and daily updates
                    </p>
                    <a 
                      href="https://t.me/AuricLedgerBot" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        padding: "8px 16px",
                        background: "#0088cc",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        textDecoration: "none",
                        fontWeight: "600",
                        fontSize: "14px"
                      }}
                    >
                      📱 Open Telegram Bot
                    </a>
                    <p style={{ margin: "10px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
                      Commands: /prices, /yesterday, /summary, /chart, /ask, /subscribe
                    </p>
                  </div>
                </div>

                {alerts.length === 0 ? (
                  <div className="faq-item" style={{ textAlign: "center", color: "var(--muted)" }}>
                    <p>No alerts yet. Create one to get started!</p>
                  </div>
                ) : (
                  <div className="faq-item">
                    <h3>📋 Your Alerts ({alerts.length})</h3>
                    <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          style={{
                            padding: "12px",
                            border: `2px solid ${alert.enabled ? "var(--accent)" : "var(--line)"}`,
                            borderRadius: "8px",
                            background: alert.enabled ? "rgba(196, 154, 60, 0.08)" : "rgba(0, 0, 0, 0.02)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                        >
                          <div>
                            <strong style={{ color: "var(--panel-ink)" }}>
                              {formatMetalLabel({ metal_name: alert.metal })}
                            </strong>
                            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "4px 0 0 0" }}>
                              {(alert.type === "price_threshold" || alert.type === "target_price")
                                ? `When price goes ${alert.direction === "above" ? "above" : "below"} ₹${alert.value.toFixed(2)}/g`
                                : `When price changes by ${alert.value.toFixed(2)}%`}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              onClick={() => toggleAlert(alert.id)}
                              style={{
                                padding: "6px 12px",
                                background: alert.enabled ? "var(--accent)" : "var(--line)",
                                color: alert.enabled ? "#fff" : "var(--muted)",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "600"
                              }}
                            >
                              {alert.enabled ? "✓ On" : "Off"}
                            </button>
                            <button
                              onClick={() => deleteAlert(alert.id)}
                              style={{
                                padding: "6px 12px",
                                background: "#b02b2b",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "600"
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="faq-item">
                  <h3>ℹ️ How Alerts Work</h3>
                  <p>
                    <strong style={{ color: "var(--accent)" }}>Price Threshold:</strong> Set a price limit — get alerted when the metal price crosses below or above your threshold. Example: Gold is ₹9,000/g, you set ₹8,500 below → alert fires when Gold drops to ₹8,500 or lower.<br/>
                    <strong style={{ color: "var(--accent)" }}>Price Change %:</strong> Get notified when a metal's daily price change exceeds your set percentage<br/>
                    <strong style={{ color: "var(--accent)" }}>Delivery:</strong> Alerts are sent via browser notification + email (if subscribed)<br/>
                    <strong style={{ color: "var(--accent)" }}>Cooldown:</strong> Each alert waits 60 minutes before triggering again to avoid duplicates
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
