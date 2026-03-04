// ─── Currency / Number Formatting ───────────────────────────────

const getNumLocale = () =>
  localStorage.getItem("auric-numfmt") === "international" ? "en-US" : "en-IN";

const isCompact = () =>
  localStorage.getItem("auric-compact-num") === "true";

export const formatMoney = (value) => {
  const v = value ?? 0;
  if (isCompact() && Math.abs(v) >= 1000) {
    return new Intl.NumberFormat(getNumLocale(), {
      style: "currency",
      currency: "INR",
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
    }).format(v);
  }
  return new Intl.NumberFormat(getNumLocale(), {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(v);
};

export const formatNumberPlain = (value) => {
  const v = value ?? 0;
  if (isCompact() && Math.abs(v) >= 1000) {
    const formatted = new Intl.NumberFormat(getNumLocale(), {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
    }).format(v);
    return `Rs.${formatted}`;
  }
  const formatted = new Intl.NumberFormat(getNumLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
  return `Rs.${formatted}`;
};

// ─── Metal Helpers ──────────────────────────────────────────────

export const unitsForMetal = (metal) => {
  if (!metal) return [];
  const name = metal.toLowerCase();
  if (name.includes("gold") || name.includes("xau")) {
    return [
      { label: "1 gram", value: "1g" },
      { label: "8 grams", value: "8g" },
    ];
  }
  return [
    { label: "1 gram", value: "1g" },
    { label: "1 kilogram", value: "1kg" },
  ];
};

export const formatMetalLabel = (metal) => {
  if (!metal) return "";
  const symbol = metal.metal_name || "";
  const name = metal.display_name || metalLabelMap[symbol] || "";
  return name || symbol;
};

export const getMetalTheme = (metal) => {
  const symbol = metal.toLowerCase();
  for (const [key, theme] of Object.entries(metalThemes)) {
    if (symbol.includes(key.toLowerCase())) return theme;
  }
  return metalThemes.XAU;
};

export const sortMetals = (metals) => {
  const order = ["XAU", "XAG", "XPT", "XPD", "XCU", "LEAD", "NI", "ZNC", "ALU"];
  return [...metals].sort((a, b) => {
    const aIdx = order.indexOf(a.metal_name);
    const bIdx = order.indexOf(b.metal_name);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
};

export const maskEmail = (email) => {
  if (!email || !email.includes("@")) return "";
  const [localPart, domain] = email.split("@");
  return `${localPart.slice(0, 3)}***@${domain}`;
};

// ─── Chart Helpers ──────────────────────────────────────────────

export const calculateChartRange = (allValues) => {
  const nums = allValues.filter((v) => Number.isFinite(v));
  if (!nums.length) return { min: 0, max: 100 };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;
  const padding = Math.max(range * 0.15, 1);
  return { min: Math.max(0, min - padding), max: max + padding };
};

export const buildChartData = (points, series) => {
  const labels = points.map((p) => dayjs(p.date).format("DD MMM"));
  const datasets = series
    .map((item) => {
      const values = points.map((p) =>
        item.getValue ? item.getValue(p) : p[item.key] ?? null
      );
      if (!values.some((v) => Number.isFinite(v))) return null;
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
        pointBorderWidth: 2,
      };
    })
    .filter(Boolean);
  return { labels, datasets };
};

const chartFont = { family: '"Inter", "Segoe UI", system-ui, sans-serif' };

export const buildChartOptions = (range) => ({
  responsive: true,
  maintainAspectRatio: true,
  animation: false,
  responsiveAnimationDuration: 0,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#5d6b7a", font: chartFont } },
    y: {
      min: range.min,
      max: range.max,
      grid: { color: "rgba(200,200,200,0.15)" },
      ticks: { color: "#5d6b7a", font: chartFont },
    },
  },
});

// ─── PDF Loader ─────────────────────────────────────────────────

let pdfLibPromise = null;
export const loadPdfLibs = () => {
  if (!pdfLibPromise) {
    pdfLibPromise = Promise.all([import("jspdf"), import("jspdf-autotable")]).then(
      ([jspdfModule]) => ({ jsPDF: jspdfModule.jsPDF })
    );
  }
  return pdfLibPromise;
};

// Re-export constants for convenience
import dayjs from "dayjs";
import { metalLabelMap, metalThemes } from "./constants";
