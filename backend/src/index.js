import express from "express";
import cors from "cors";
import axios from "axios";
import cron from "node-cron";
import dayjs from "dayjs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const {
  PORT = 4000,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  METALS_API_KEY,
  METALS_API_URL = "https://metals.g.apised.com/v1/latest",
  METALS_SYMBOLS_URL = "https://metals.g.apised.com/v1/supported-metals",
  USD_INR_OVERRIDE,
  CRON_SCHEDULE = "0 6 * * *"
} = process.env;

if (!METALS_API_KEY) {
  console.warn("Missing METALS_API_KEY. Metal price fetching will fail.");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn("Missing Supabase credentials. API routes will fail until configured.");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_KEY || "");

// Email configuration
const {
  EMAIL_SERVICE = "gmail",
  EMAIL_USER,
  EMAIL_PASSWORD,
  EMAIL_FROM = EMAIL_USER
} = process.env;

let emailTransporter = null;
if (EMAIL_USER && EMAIL_PASSWORD) {
  emailTransporter = nodemailer.createTransport({
    service: EMAIL_SERVICE,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD
    }
  });
} else {
  console.warn("⚠️  Email credentials not configured. Daily price emails will not be sent.");
  console.warn("Set EMAIL_USER and EMAIL_PASSWORD in .env to enable email notifications.");
}

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
  
  // apised.com format: { status: "success", data: [{ metal_code, metal_name, ... }] }
  if (data.data && Array.isArray(data.data)) {
    return data.data.map((item) => ({
      symbol: item.metal_code || item.symbol,
      name: item.metal_name || item.name || item.metal_code || item.symbol
    })).filter(item => item.symbol);
  }
  
  // Fallback for other formats
  const fromArray = (items) =>
    items
      .map((item) => {
        if (typeof item === "string") return { symbol: item, name: null };
        if (typeof item === "object" && item) {
          return {
            symbol: item.symbol || item.code || item.metal || item.metal_code || item.name,
            name: item.name || item.metal_name || null
          };
        }
        return null;
      })
      .filter((item) => item && item.symbol);

  if (Array.isArray(data.symbols)) return fromArray(data.symbols);
  if (Array.isArray(data)) return fromArray(data);
  if (data.symbols && typeof data.symbols === "object") {
    return Object.entries(data.symbols).map(([symbol, name]) => ({ symbol, name }));
  }
  return [];
};

const normalizePriceResponse = (data, symbol) => {
  if (!data) return null;
  
  // apised.com format: { data: { rates: { XAU: 2000.50, ... } } }
  if (data.data && data.data.rates && symbol) {
    const value = Number(data.data.rates[symbol]);
    if (Number.isFinite(value)) return value;
  }
  
  // Fallback for other formats
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

  const response = await axios.get(METALS_SYMBOLS_URL, {
    headers: { "x-api-key": METALS_API_KEY },
    params: { search: "" }
  });
  
  const symbols = normalizeSymbolsResponse(response.data);
  if (!symbols.length) {
    throw new Error("No symbols returned from metals API");
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

  // Fetch all metal prices in a single request
  const symbolsList = symbols.map(s => s.symbol).join(",");
  const response = await axios.get(METALS_API_URL, {
    headers: { "x-api-key": METALS_API_KEY },
    params: {
      symbols: symbolsList,
      base_currency: "USD"
    }
  });

  const results = symbols.map((item) => {
    try {
      const price = normalizePriceResponse(response.data, item.symbol);
      if (!Number.isFinite(price)) {
        throw new Error(`Invalid price for ${item.symbol}`);
      }
      return { status: "fulfilled", value: { symbol: item.symbol, price } };
    } catch (error) {
      return { status: "rejected", reason: error };
    }
  });

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

const summarizeFetchResult = (result) => {
  if (!result) return null;
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const metals = Array.from(new Set(rows.map((row) => row.metal_name))).sort();
  return {
    date: result.date,
    usdToInr: result.usdToInr,
    rows_count: rows.length,
    metals
  };
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
    
    // Log detailed information similar to cron job
    if (!cached && result.rows && result.rows.length > 0) {
      const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss");
      console.log(`\n${"=".repeat(60)}`);
      console.log(`[${timestamp}] Manual fetch completed`);
      console.log(`${"=".repeat(60)}`);
      console.log(`\n✅ SUCCESS`);
      console.log(`📅 Date: ${result.date}`);
      console.log(`💱 USD to INR: ${result.usdToInr}`);
      console.log(`📊 Total rows: ${result.rows.length}`);
      console.log(`\n🏷️  Metals processed:`);
      
      const metalGroups = {};
      result.rows.forEach(row => {
        if (!metalGroups[row.metal_name]) {
          metalGroups[row.metal_name] = [];
        }
        metalGroups[row.metal_name].push(row);
      });
      
      Object.keys(metalGroups).forEach(metal => {
        const rows = metalGroups[metal];
        console.log(`   • ${metal}: ${rows.length} row(s)`);
        rows.forEach(row => {
          const caratInfo = row.carat ? ` (${row.carat}K)` : '';
          console.log(`     - ₹${row.price_1g?.toFixed(2) || 'N/A'}/g${caratInfo}`);
        });
      });
      
      console.log(`\n${"=".repeat(60)}\n`);
    }
    
    res.json({ status: "ok", cached, retry_after_minutes, ...result });
  } catch (error) {
    console.error(`\n❌ FAILED - Fetch error: ${error.message}`);
    if (error.stack) {
      console.error(`📋 Stack:\n${error.stack}\n`);
    }
    res.status(500).json({ status: "error", message: error.message });
  }
});

// GET version for external cron services
app.get("/fetch-today-prices", async (req, res) => {
  try {
    const { result, cached, retry_after_minutes } = await fetchWithGuard();
    const verbose = req.query.verbose === "1" || req.query.verbose === "true";
    const payload = verbose ? result : summarizeFetchResult(result);
    res.json({ status: "ok", cached, retry_after_minutes, ...payload });
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

// Email subscription endpoint
app.post("/subscribe-email", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes("@")) {
      return res.status(400).json({ status: "error", message: "Invalid email" });
    }

    // Ensure table exists
    const { data: existing, error: fetchError } = await supabase
      .from("price_email_subscriptions")
      .select("id")
      .eq("email", email)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(`Query error: ${fetchError.message}`);
    }

    let result;
    if (existing) {
      // Update existing subscription
      result = await supabase
        .from("price_email_subscriptions")
        .update({ subscribed_at: new Date().toISOString() })
        .eq("email", email);
    } else {
      // Create new subscription
      result = await supabase
        .from("price_email_subscriptions")
        .insert([{ email, subscribed_at: new Date().toISOString() }]);
    }

    if (result.error) {
      throw new Error(`Database error: ${result.error.message}`);
    }

    res.json({ status: "success", message: "Email subscribed successfully" });
  } catch (error) {
    console.error("Email subscription error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Function to send daily price emails
const sendDailyPriceEmails = async (priceData) => {
  if (!emailTransporter) {
    console.log("📧 Email sending not configured. Skipping email notifications.");
    return;
  }

  try {
    // Fetch all subscribed emails
    const { data: subscriptions, error } = await supabase
      .from("price_email_subscriptions")
      .select("email")
      .gt("subscribed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Only recent subscriptions

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      console.log("📧 No email subscribers found.");
      return;
    }

    // Format email content with prices
    let priceContent = "<h2>Today's Precious Metals Prices</h2><table border='1' cellpadding='10' style='border-collapse:collapse'>";
    priceContent += "<tr style='background-color:#f0f0f0'><th>Metal</th><th>Price (₹/g)</th></tr>";
    
    priceData.rows.forEach(row => {
      if (row.unit === "per_gram" && row.metal_name !== "HG") {
        priceContent += `<tr><td><strong>${row.metal_name}</strong></td><td>₹${row.price_1g?.toFixed(2) || "N/A"}</td></tr>`;
      }
    });
    priceContent += "</table>";

    const emailContent = `
      <h1>🏆 Auric Ledger - Daily Price Update</h1>
      <p>📅 Date: ${dayjs().format("DD MMM YYYY")}</p>
      <p>💱 USD to INR Rate: ₹${priceData.usdToInr.toFixed(2)}</p>
      ${priceContent}
      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        You received this email because you're subscribed to daily price updates on Auric Ledger.
        To manage your preferences, visit the app and go to Alerts settings.
      </p>
    `;

    // Send email to all subscribers
    for (const subscription of subscriptions) {
      try {
        await emailTransporter.sendMail({
          from: EMAIL_FROM,
          to: subscription.email,
          subject: `Daily Metals Prices - ${dayjs().format("DD MMM YYYY")}`,
          html: emailContent
        });
        console.log(`✅ Email sent to ${subscription.email}`);
      } catch (sendError) {
        console.error(`❌ Failed to send email to ${subscription.email}:`, sendError.message);
      }
    }
  } catch (error) {
    console.error("❌ Error in sendDailyPriceEmails:", error.message);
  }
};

cron.schedule(CRON_SCHEDULE, async () => {
  const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss");
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${timestamp}] Starting daily price fetch...`);
  console.log(`${"=".repeat(60)}`);
  
  try {
    const result = await fetchAndStoreToday();
    
    console.log(`\n✅ SUCCESS - Daily price fetch completed`);
    console.log(`📅 Date: ${result.date}`);
    console.log(`💱 USD to INR: ${result.usdToInr}`);
    console.log(`📊 Total rows stored: ${result.rows.length}`);
    console.log(`\n🏷️  Metals processed:`);
    
    const metalGroups = {};
    result.rows.forEach(row => {
      if (!metalGroups[row.metal_name]) {
        metalGroups[row.metal_name] = [];
      }
      metalGroups[row.metal_name].push(row);
    });
    
    Object.keys(metalGroups).forEach(metal => {
      const rows = metalGroups[metal];
      console.log(`   • ${metal}: ${rows.length} row(s)`);
      rows.forEach(row => {
        const caratInfo = row.carat ? ` (${row.carat}K)` : '';
        console.log(`     - ₹${row.price_1g?.toFixed(2) || 'N/A'}/g${caratInfo}`);
      });
    });
    
    // Send daily price emails to subscribers
    console.log(`\n📧 Sending daily price emails...`);
    await sendDailyPriceEmails(result);
    
    console.log(`\n${"=".repeat(60)}\n`);
  } catch (error) {
    console.error(`\n❌ FAILED - Daily price fetch failed`);
    console.error(`📅 Time: ${timestamp}`);
    console.error(`⚠️  Error: ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    console.error(`${"=".repeat(60)}\n`);
  }
});

app.listen(PORT, () => {
  console.log(`API listening on ${PORT}`);
  console.log(`Cron job scheduled: ${CRON_SCHEDULE} (default: 6 AM daily)`);
});
