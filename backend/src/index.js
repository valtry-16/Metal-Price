import express from "express";
import cors from "cors";
import axios from "axios";
import cron from "node-cron";
import dayjs from "dayjs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const {
  PORT = 4000,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  GOLD_API_URL = "https://api.gold-api.com/price/",
  SYMBOLS_URL = "https://api.gold-api.com/symbols",
  USD_INR_OVERRIDE,
  CRON_SCHEDULE = "0 6 * * *"
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn("Missing Supabase credentials. API routes will fail until configured.");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_KEY || "");

const OUNCE_TO_GRAM = 31.1035;
const DUTY = 1.06;
const GST = 1.03;

const GOLD_CARATS = [
  { carat: "18", purity: 0.75 },
  { carat: "22", purity: 0.916 },
  { carat: "24", purity: 1 }
];

const fetchCache = {
  lastRunAt: null,
  lastResult: null
};

const MIN_FETCH_INTERVAL_MINUTES = 15;

const symbolCache = {
  symbols: [],
  updatedAt: null
};

const normalizeSymbolsResponse = (data) => {
  if (!data) return [];
  const fromArray = (items) =>
    items
      .map((item) => {
        if (typeof item === "string") return { symbol: item, name: null };
        if (typeof item === "object" && item) {
          return {
            symbol: item.symbol || item.code || item.metal || item.name,
            name: item.name || item.metal_name || null
          };
        }
        return null;
      })
      .filter((item) => item && item.symbol);

  if (Array.isArray(data.symbols)) return fromArray(data.symbols);
  if (Array.isArray(data.data)) return fromArray(data.data);
  if (Array.isArray(data)) return fromArray(data);
  if (data.symbols && typeof data.symbols === "object") {
    return Object.entries(data.symbols).map(([symbol, name]) => ({ symbol, name }));
  }
  return [];
};

const normalizePriceResponse = (data) => {
  if (!data) return null;
  const candidate =
    data.price ??
    data.price_usd ??
    data?.data?.price ??
    data?.data?.price_usd ??
    data?.result?.price ??
    null;
  const value = Number(candidate);
  return Number.isFinite(value) ? value : null;
};

const getMetalSymbols = async () => {
  if (symbolCache.symbols.length && symbolCache.updatedAt) {
    const ageHours = dayjs().diff(symbolCache.updatedAt, "hour");
    if (ageHours < 24) return symbolCache.symbols;
  }

  const response = await axios.get(SYMBOLS_URL);
  const symbols = normalizeSymbolsResponse(response.data);
  if (!symbols.length) {
    throw new Error("No symbols returned from gold API");
  }

  symbolCache.symbols = symbols;
  symbolCache.updatedAt = dayjs();

  return symbols;
};

const getUsdToInrRate = async () => {
  if (USD_INR_OVERRIDE) {
    return Number(USD_INR_OVERRIDE);
  }
  const response = await axios.get("https://api.frankfurter.app/latest", {
    params: { from: "USD", to: "INR" }
  });
  const rate = response.data?.rates?.INR;
  if (!rate) {
    throw new Error("Unable to fetch USD to INR rate");
  }
  return Number(rate);
};

const isGold = (metal) => {
  const name = metal.toLowerCase();
  return name.includes("gold") || name.includes("xau");
};

const isSilver = (metal) => {
  const name = metal.toLowerCase();
  return name.includes("silver") || name.includes("xag");
};

const resolveCarat = (metal, carat) => {
  if (metal && isGold(metal)) {
    return carat || "22";
  }
  return null;
};

const buildRowsForMetal = ({ metal, priceUsd, usdToInr, date }) => {
  const perGramInr = (Number(priceUsd) / OUNCE_TO_GRAM) * usdToInr;
  const finalPrice = perGramInr * DUTY * GST;

  if (isGold(metal)) {
    return GOLD_CARATS.map((caratInfo) => {
      const caratPrice = finalPrice * caratInfo.purity;
      return {
        metal_name: metal,
        price_per_gram: caratPrice,
        price_per_kg: null,
        price_1g: caratPrice,
        price_8g: caratPrice * 8,
        carat: caratInfo.carat,
        currency: "INR",
        date,
        created_at: new Date().toISOString()
      };
    });
  }

  const perKg = finalPrice * 1000;

  return [
    {
      metal_name: metal,
      price_per_gram: finalPrice,
      price_per_kg: perKg,
      price_1g: finalPrice,
      price_8g: null,
      carat: null,
      currency: "INR",
      date,
      created_at: new Date().toISOString()
    }
  ];
};

const fetchAndStoreToday = async () => {
  const today = dayjs().format("YYYY-MM-DD");
  const [symbols, usdToInr] = await Promise.all([getMetalSymbols(), getUsdToInrRate()]);

  const baseUrl = GOLD_API_URL.endsWith("/") ? GOLD_API_URL : `${GOLD_API_URL}/`;
  const results = await Promise.allSettled(
    symbols.map(async (item) => {
      const response = await axios.get(`${baseUrl}${item.symbol}`);
      const price = normalizePriceResponse(response.data);
      if (!Number.isFinite(price)) {
        throw new Error(`Invalid price for ${item.symbol}`);
      }
      return { symbol: item.symbol, price };
    })
  );

  const rows = results.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    return buildRowsForMetal({
      metal: result.value.symbol,
      priceUsd: result.value.price,
      usdToInr,
      date: today
    });
  });

  if (!rows.length) {
    throw new Error("No prices fetched for available symbols");
  }

  const { data, error } = await supabase
    .from("metal_prices")
    .upsert(rows, { onConflict: "metal_name,carat,date" })
    .select();

  if (error) {
    throw error;
  }

  return { rows: data || [], usdToInr, date: today };
};

const fetchWithGuard = async () => {
  if (fetchCache.lastRunAt) {
    const minutesSince = dayjs().diff(fetchCache.lastRunAt, "minute");
    if (minutesSince < MIN_FETCH_INTERVAL_MINUTES && fetchCache.lastResult) {
      return {
        result: fetchCache.lastResult,
        cached: true,
        retry_after_minutes: MIN_FETCH_INTERVAL_MINUTES - minutesSince
      };
    }
  }

  const result = await fetchAndStoreToday();
  fetchCache.lastRunAt = dayjs();
  fetchCache.lastResult = result;
  return { result, cached: false, retry_after_minutes: 0 };
};

const getLatestDate = async () => {
  const { data, error } = await supabase.from("metal_prices").select("date").order("date", { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0]?.date;
};

const getLatestRows = async ({ metal, carat }) => {
  const latestDate = await getLatestDate();
  if (!latestDate) return { latestDate: null, rows: [] };

  let query = supabase.from("metal_prices").select("*").eq("date", latestDate);
  if (metal) query = query.eq("metal_name", metal);
  if (carat) query = query.eq("carat", carat);
  if (carat === null) query = query.is("carat", null);

  const { data, error } = await query;
  if (error) throw error;

  return { latestDate, rows: data || [] };
};

const getLatestForMetal = async ({ metal, carat }) => {
  let query = supabase
    .from("metal_prices")
    .select("*")
    .eq("metal_name", metal)
    .order("date", { ascending: false })
    .limit(1);

  if (carat) query = query.eq("carat", carat);
  if (!carat) query = query.is("carat", null);

  const { data, error } = await query;
  if (error) throw error;

  return data?.[0] || null;
};

const getComparison = async ({ metal, carat }) => {
  let query = supabase
    .from("metal_prices")
    .select("date, price_1g, price_8g, price_per_kg")
    .eq("metal_name", metal)
    .order("date", { ascending: false })
    .limit(10);  // Get more rows to ensure we have at least 2 unique dates

  if (carat) query = query.eq("carat", carat);
  if (!carat) query = query.is("carat", null);

  const { data, error } = await query;
  if (error) throw error;
  
  // Deduplicate by date
  const uniqueData = [];
  const seenDates = new Set();
  for (const row of data || []) {
    if (!seenDates.has(row.date)) {
      seenDates.add(row.date);
      uniqueData.push(row);
      if (uniqueData.length === 2) break;  // We only need 2 unique dates
    }
  }
  
  if (uniqueData.length < 2) return null;

  const [today, yesterday] = uniqueData;

  return {
    metal_name: metal,
    today_date: today.date,
    yesterday_date: yesterday.date,
    today_prices: {
      price_1g: today.price_1g,
      price_8g: today.price_8g,
      price_per_kg: today.price_per_kg
    },
    yesterday_prices: {
      price_1g: yesterday.price_1g,
      price_8g: yesterday.price_8g,
      price_per_kg: yesterday.price_per_kg
    }
  };
};

const getWeeklyHistory = async ({ metal, carat }) => {
  let query = supabase
    .from("metal_prices")
    .select("date, price_1g, price_8g, price_per_kg")
    .eq("metal_name", metal)
    .order("date", { ascending: false })
    .limit(7);

  if (carat) query = query.eq("carat", carat);
  if (!carat) query = query.is("carat", null);

  const { data, error } = await query;
  if (error) throw error;

  // Deduplicate by date (in case of duplicate entries)
  const uniqueData = [];
  const seenDates = new Set();
  for (const row of data || []) {
    if (!seenDates.has(row.date)) {
      seenDates.add(row.date);
      uniqueData.push(row);
    }
  }

  return uniqueData.reverse();
};

const getMonthlyHistory = async ({ metal, carat, month }) => {
  const start = dayjs(month + "-01");
  const end = start.endOf("month");

  let query = supabase
    .from("metal_prices")
    .select("date, price_1g, price_8g, price_per_kg")
    .eq("metal_name", metal)
    .gte("date", start.format("YYYY-MM-DD"))
    .lte("date", end.format("YYYY-MM-DD"))
    .order("date", { ascending: true });

  if (carat) query = query.eq("carat", carat);
  if (!carat) query = query.is("carat", null);

  const { data, error } = await query;
  if (error) throw error;

  // Deduplicate by date (in case of duplicate entries)
  const uniqueData = [];
  const seenDates = new Set();
  for (const row of data || []) {
    if (!seenDates.has(row.date)) {
      seenDates.add(row.date);
      uniqueData.push(row);
    }
  }

  return uniqueData;
};

const getAvailableMonths = async ({ metal, carat }) => {
  const since = dayjs().subtract(6, "month").format("YYYY-MM-DD");
  let query = supabase
    .from("metal_prices")
    .select("date")
    .eq("metal_name", metal)
    .gte("date", since)
    .order("date", { ascending: false });

  if (carat) query = query.eq("carat", carat);
  if (!carat) query = query.is("carat", null);

  const { data, error } = await query;
  if (error) throw error;

  const months = new Set(
    (data || []).map((item) => dayjs(item.date).format("YYYY-MM"))
  );

  return Array.from(months).sort();
};

app.get("/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post("/fetch-today-prices", async (req, res) => {
  try {
    const { result, cached, retry_after_minutes } = await fetchWithGuard();
    res.json({ status: "ok", cached, retry_after_minutes, ...result });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// GET version for external cron services
app.get("/fetch-today-prices", async (req, res) => {
  try {
    const { result, cached, retry_after_minutes } = await fetchWithGuard();
    res.json({ status: "ok", cached, retry_after_minutes, ...result });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/get-latest-price", async (req, res) => {
  try {
    const { metal, carat } = req.query;
    if (!metal) {
      const { latestDate, rows } = await getLatestRows({});
      let metals = Array.from(new Set(rows.map((row) => row.metal_name))).map((name) => ({
        metal_name: name
      }));
      if (!metals.length) {
        const symbols = await getMetalSymbols();
        metals = symbols.map((item) => ({
          metal_name: item.symbol,
          display_name: item.name
        }));
      }
      return res.json({ latestDate, metals });
    }

    const resolvedCarat = resolveCarat(metal, carat);
    const latest = await getLatestForMetal({ metal, carat: resolvedCarat });
    let caratPrices = null;

    if (latest && isGold(metal)) {
      const { latestDate, rows } = await getLatestRows({ metal });
      caratPrices = rows.reduce((acc, row) => {
        if (row.carat) acc[row.carat] = row.price_1g;
        return acc;
      }, {});
      latest.carat_prices = caratPrices;
      latest.date = latestDate;
    }

    res.json({ latest });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/compare-yesterday", async (req, res) => {
  try {
    const { metal, carat } = req.query;
    if (!metal) {
      return res.status(400).json({ status: "error", message: "metal is required" });
    }
    const resolvedCarat = resolveCarat(metal, carat);
    const comparison = await getComparison({ metal, carat: resolvedCarat });
    res.json({ comparison });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/weekly-history", async (req, res) => {
  try {
    const { metal, carat } = req.query;
    if (!metal) {
      return res.status(400).json({ status: "error", message: "metal is required" });
    }
    const resolvedCarat = resolveCarat(metal, carat);
    const history = await getWeeklyHistory({ metal, carat: resolvedCarat });
    res.json({ history });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/monthly-history", async (req, res) => {
  try {
    const { metal, carat, month } = req.query;
    if (!metal) {
      return res.status(400).json({ status: "error", message: "metal is required" });
    }

    const resolvedCarat = resolveCarat(metal, carat);
    const availableMonths = await getAvailableMonths({ metal, carat: resolvedCarat });
    const selectedMonth = month || availableMonths[availableMonths.length - 1];
    const history = selectedMonth
      ? await getMonthlyHistory({ metal, carat: resolvedCarat, month: selectedMonth })
      : [];

    res.json({ history, availableMonths, selectedMonth });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

cron.schedule(CRON_SCHEDULE, async () => {
  try {
    await fetchAndStoreToday();
    console.log(`[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] Daily price fetched and stored.`);
  } catch (error) {
    console.error(`[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] Daily price fetch failed:`, error.message);
  }
});

app.listen(PORT, () => {
  console.log(`API listening on ${PORT}`);
  console.log(`Cron job scheduled: ${CRON_SCHEDULE} (default: 6 AM daily)`);
});
