import express from "express";
import cors from "cors";
import axios from "axios";
import cron from "node-cron";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { sendDailyPricesToTelegram } from "./telegram-bot.js";
import bot from "./telegram-bot.js";

dotenv.config();
dayjs.extend(utc);
dayjs.extend(timezone);

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
  CRON_SCHEDULE = "0 6 * * *",
  CRON_VERBOSE = "false",
  CRON_ENABLED = "true",
  RUN_DAILY_SECRET,
  RUN_WELCOME_EMAIL_SECRET
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
  EMAIL_SERVICE = "brevo",
  EMAIL_USER,
  EMAIL_PASSWORD,
  BREVO_API_KEY,
  EMAIL_FROM = EMAIL_USER
} = process.env;

// Brevo API email sender function
const sendEmailViaBrevo = async (to, subject, htmlContent) => {
  if (!BREVO_API_KEY) {
    console.error("❌ BREVO_API_KEY is not configured");
    return false;
  }

  try {
    const response = await axios.post("https://api.brevo.com/v3/smtp/email", {
      to: [{ email: to }],
      sender: { email: EMAIL_USER, name: "Auric Ledger" },
      subject: subject,
      htmlContent: htmlContent
    }, {
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json"
      }
    });

    console.log(`📧 Email sent to ${to} (Message ID: ${response.data.messageId})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.response?.data?.message || error.message);
    return false;
  }
};

let emailTransporter = null;
// For backward compatibility, keep emailTransporter as a simple object with sendMail method
if (EMAIL_USER) {
  emailTransporter = {
    sendMail: async (mailOptions) => {
      return sendEmailViaBrevo(mailOptions.to, mailOptions.subject, mailOptions.html);
    }
  };
  console.log(`✅ Email service initialized (Brevo API - ${EMAIL_USER})`);
} else {
  console.warn("⚠️  Email credentials not configured. Daily price emails will not be sent.");
  console.warn("Set EMAIL_USER in .env to enable email notifications.");
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

// Telegram webhook endpoint - receives updates from Telegram servers
app.post("/telegram/webhook", async (req, res) => {
  try {
    if (!bot) {
      console.warn("⚠️ Bot not initialized");
      return res.status(400).json({ status: "error", message: "Bot not initialized" });
    }
    
    // Pass the update to the bot
    await bot.processUpdate(req.body);
    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Telegram webhook error:", error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
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
    let isNewSubscription = false;
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
      isNewSubscription = true;
    }

    if (result.error) {
      throw new Error(`Database error: ${result.error.message}`);
    }

    // Just insert subscription, don't send welcome immediately (avoid timeout)
    if (isNewSubscription) {
      console.log(`📧 New subscription from ${email}`);
      console.log(`💡 Welcome email will be sent shortly by background cron job`);
      res.json({ status: "success", message: "✅ Subscribed! Your welcome email is coming shortly." });
    } else {
      console.log(`ℹ️ Email already subscribed (not new), skipping welcome email`);
      res.json({ status: "success", message: "✅ Email already subscribed. Continue receiving daily price updates!" });
    }
  } catch (error) {
    console.error("Email subscription error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Send welcome email with today's prices
const sendWelcomeEmail = async (email, priceData) => {
  if (!emailTransporter) return;

  // Available metals in dropdown (matching frontend dropdown)
  const availableMetals = ['XAU', 'XAG', 'XPT', 'XPD', 'XCU', 'LEAD', 'NI', 'ZNC', 'ALU'];
  
  // Get unique metals with their prices (for gold, only use 22K)
  const metalPrices = {};
  
  priceData.rows.forEach(row => {
    // Only include metals that are in the dropdown
    if (!availableMetals.includes(row.metal_name)) return;
    
    // Special handling for Gold - only use 22K carat
    if (row.metal_name === "XAU") {
      if (row.carat === "22" && row.price_1g) {
        metalPrices['XAU'] = row.price_1g;
      }
      return;
    }
    
    // For other metals, just take the first price
    if (!metalPrices[row.metal_name] && row.price_1g) {
      metalPrices[row.metal_name] = row.price_1g;
    }
  });

  // Build price table rows (in the order of availableMetals)
  const metalNames = {
    'XAU': 'Gold',
    'XAG': 'Silver',
    'XPT': 'Platinum',
    'XPD': 'Palladium',
    'XCU': 'Copper',
    'LEAD': 'Lead',
    'NI': 'Nickel',
    'ZNC': 'Zinc',
    'ALU': 'Aluminium'
  };

  let priceRows = '';
  availableMetals.forEach(metal => {
    const displayName = metalNames[metal];
    const price = metalPrices[metal];
    const priceDisplay = price ? `₹${price.toFixed(2)}` : 'N/A';
    priceRows += `
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd;">${displayName}</td>
        <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${priceDisplay}</td>
      </tr>`;
  });

  const emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header with Logo and Branding -->
              <tr>
                <td style="background: linear-gradient(135deg, #d4af37 0%, #f4e5c3 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #2c3e50; font-size: 32px; font-weight: bold;">Auric Ledger</h1>
                  <p style="margin: 5px 0 0 0; color: #555; font-size: 14px;">Your Trusted Precious Metals Price Tracker</p>
                </td>
              </tr>
              
              <!-- Welcome Message -->
              <tr>
                <td style="padding: 30px;">
                  <h2 style="color: #d4af37; margin: 0 0 15px 0; font-size: 24px;">Welcome to Our Community!</h2>
                  <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0;">
                    Dear Valued Subscriber,
                  </p>
                  <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 15px 0 0 0;">
                    Thank you for joining <strong>Auric Ledger</strong>! We're delighted to have you on board. 
                    You've taken the first step towards staying informed about precious metals prices in the Indian market.
                  </p>
                </td>
              </tr>
              
              <!-- Date Section -->
              <tr>
                <td style="padding: 0 30px;">
                  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #d4af37;">
                    <p style="margin: 0; color: #666; font-size: 14px;"><strong>Date:</strong> ${dayjs().format("DD MMMM YYYY")}</p>
                    <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;"><strong>USD to INR:</strong> ${priceData.usdToInr ? `₹${priceData.usdToInr.toFixed(2)}` : "N/A"}</p>
                  </div>
                </td>
              </tr>
              
              <!-- Metal Prices Table -->
              <tr>
                <td style="padding: 30px;">
                  <h3 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 20px;">Today's Metal Prices</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #ddd;">
                    <thead>
                      <tr style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);">
                        <th style="padding: 15px; text-align: left; color: #ffffff; font-size: 15px; border: 1px solid #ddd;">Metal</th>
                        <th style="padding: 15px; text-align: right; color: #ffffff; font-size: 15px; border: 1px solid #ddd;">Price per Gram</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${priceRows}
                    </tbody>
                  </table>
                  <p style="color: #888; font-size: 13px; margin: 15px 0 0 0; font-style: italic;">
                    * All prices are inclusive of import duty and GST, converted to INR
                  </p>
                </td>
              </tr>
              
              <!-- Information Box -->
              <tr>
                <td style="padding: 0 30px 30px 30px;">
                  <div style="background-color: #e8f5e9; padding: 20px; border-radius: 6px; border: 1px solid #c8e6c9;">
                    <p style="margin: 0; color: #2e7d32; font-size: 14px; line-height: 1.6;">
                      <strong>What's Next?</strong><br>
                      You'll receive daily price updates every morning at <strong>9:00 AM IST</strong>. 
                      Stay ahead of the market with real-time pricing delivered straight to your inbox!
                    </p>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #2c3e50; padding: 25px; text-align: center; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0 0 10px 0; color: #ecf0f1; font-size: 14px;">
                    Manage your subscription preferences anytime in the app
                  </p>
                  <a href="https://auric-ledger.vercel.app" style="display: inline-block; padding: 12px 30px; background-color: #d4af37; color: #2c3e50; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; margin-top: 10px;">
                    Visit Auric Ledger
                  </a>
                  <p style="margin: 20px 0 0 0; color: #95a5a6; font-size: 12px;">
                    © 2026 Auric Ledger. All rights reserved.<br>
                    <strong>Your trusted source for precious metals pricing.</strong>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await emailTransporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: `🎉 Welcome to Auric Ledger - Today's Prices Inside!`,
    html: emailContent
  });
};

// Endpoint to trigger manual price alert (user-set alerts)
app.post("/trigger-price-alert", async (req, res) => {
  try {
    const { email, metalName, currentPrice, alertType, targetValue, browserNotificationEnabled } = req.body;
    
    if (!email || !metalName || !currentPrice) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    // Send email if email notifications are enabled and email is subscribed
    if (email && emailTransporter) {
      const { data: subscription } = await supabase
        .from("price_email_subscriptions")
        .select("email")
        .eq("email", email)
        .single();

      if (subscription) {
        const message = alertType === "target_price"
          ? `${metalName} has reached your target price of ₹${targetValue}/g! Current price: ₹${currentPrice.toFixed(2)}/g`
          : `${metalName} has changed by ${targetValue}%! Current price: ₹${currentPrice.toFixed(2)}/g`;

        const alertTitle = alertType === "target_price"
          ? "Target Price Reached!"
          : "Price Change Alert!";

        const emailContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header with Logo and Branding -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #d4af37 0%, #f4e5c3 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; color: #2c3e50; font-size: 32px; font-weight: bold;">Auric Ledger</h1>
                        <p style="margin: 5px 0 0 0; color: #555; font-size: 14px;">Price Alert Notification</p>
                      </td>
                    </tr>
                    
                    <!-- Alert Message -->
                    <tr>
                      <td style="padding: 30px;">
                        <h2 style="color: #d4af37; margin: 0 0 15px 0; font-size: 24px;">${alertTitle}</h2>
                        <div style="background-color: #fff3cd; padding: 20px; border-radius: 6px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
                          <p style="margin: 0; color: #856404; font-size: 16px; line-height: 1.6; font-weight: bold;">
                            ${message}
                          </p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Alert Details -->
                    <tr>
                      <td style="padding: 0 30px 30px 30px;">
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px;">
                          <table width="100%" cellpadding="8" cellspacing="0">
                            <tr>
                              <td style="color: #666; font-size: 14px; padding: 8px 0;">
                                <strong>Metal:</strong>
                              </td>
                              <td style="color: #333; font-size: 14px; padding: 8px 0; text-align: right;">
                                <strong>${metalName}</strong>
                              </td>
                            </tr>
                            <tr>
                              <td style="color: #666; font-size: 14px; padding: 8px 0;">
                                <strong>Current Price:</strong>
                              </td>
                              <td style="color: #d4af37; font-size: 18px; padding: 8px 0; text-align: right; font-weight: bold;">
                                ₹${currentPrice.toFixed(2)}/g
                              </td>
                            </tr>
                            ${alertType === "target_price" ? `
                            <tr>
                              <td style="color: #666; font-size: 14px; padding: 8px 0;">
                                <strong>Target Price:</strong>
                              </td>
                              <td style="color: #333; font-size: 14px; padding: 8px 0; text-align: right;">
                                ₹${targetValue}/g
                              </td>
                            </tr>
                            ` : `
                            <tr>
                              <td style="color: #666; font-size: 14px; padding: 8px 0;">
                                <strong>Change Threshold:</strong>
                              </td>
                              <td style="color: #333; font-size: 14px; padding: 8px 0; text-align: right;">
                                ${targetValue}%
                              </td>
                            </tr>
                            `}
                            <tr>
                              <td style="color: #666; font-size: 14px; padding: 8px 0;">
                                <strong>Alert Time:</strong>
                              </td>
                              <td style="color: #333; font-size: 14px; padding: 8px 0; text-align: right;">
                                ${dayjs().format("DD MMM YYYY, HH:mm:ss")}
                              </td>
                            </tr>
                          </table>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Action Box -->
                    <tr>
                      <td style="padding: 0 30px 30px 30px;">
                        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 6px; border: 1px solid #c8e6c9;">
                          <p style="margin: 0; color: #2e7d32; font-size: 14px; line-height: 1.6;">
                            <strong>What's Next?</strong><br>
                            Visit the app to view detailed price charts and manage your alerts. 
                            You can modify or delete this alert anytime from the Alerts settings.
                          </p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #2c3e50; padding: 25px; text-align: center; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0 0 10px 0; color: #ecf0f1; font-size: 14px;">
                          View detailed charts and manage your alerts
                        </p>
                        <a href="https://auric-ledger.vercel.app" style="display: inline-block; padding: 12px 30px; background-color: #d4af37; color: #2c3e50; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; margin-top: 10px;">
                          Open Auric Ledger
                        </a>
                        <p style="margin: 20px 0 0 0; color: #95a5a6; font-size: 12px;">
                          © 2026 Auric Ledger. All rights reserved.<br>
                          <strong>Your trusted source for precious metals pricing.</strong>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;

        await emailTransporter.sendMail({
          from: EMAIL_FROM,
          to: email,
          subject: `🚨 Price Alert: ${metalName} - Auric Ledger`,
          html: emailContent
        });
        console.log(`✅ Price alert email sent to ${email} for ${metalName}`);
      }
    }

    res.json({ status: "success", message: "Alert triggered successfully" });
  } catch (error) {
    console.error("Trigger price alert error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Endpoint to get daily price summary for browser notifications
app.get("/daily-price-summary", async (req, res) => {
  try {
    const todayDate = dayjs().format("YYYY-MM-DD");
    
    // Get today's prices for all metals
    const { data, error } = await supabase
      .from("metal_prices")
      .select("metal_name, display_name, price_1g, carat")
      .eq("date", todayDate)
      .eq("unit", "per_gram")
      .in("metal_name", ["XAU", "XAG", "XPT", "XPD", "XCU", "NI", "ZNC", "ALU", "LEAD"])
      .order("metal_name");

    if (error) throw error;

    // Format summary
    const summary = data
      .filter(row => !row.carat || row.carat === "22") // Only 22K gold or non-gold metals
      .map(row => ({
        metal: row.metal_name,
        name: row.display_name || row.metal_name,
        price: row.price_1g
      }));

    res.json({ 
      status: "success", 
      date: todayDate,
      summary 
    });
  } catch (error) {
    console.error("Daily price summary error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Function to send daily price emails
const sendDailyPriceEmails = async (priceData) => {
  if (!emailTransporter) {
    console.log("📧 Email sending not configured. Skipping email notifications.");
    return;
  }

  const verboseEmailLogs = CRON_VERBOSE === "true";

  try {
    // Fetch all subscribed emails with their subscription dates
    const { data: subscriptions, error } = await supabase
      .from("price_email_subscriptions")
      .select("email, subscribed_at");

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      console.log("📧 No email subscribers found.");
      return;
    }

    // Available metals in dropdown (matching frontend dropdown)
    const availableMetals = ['XAU', 'XAG', 'XPT', 'XPD', 'XCU', 'LEAD', 'NI', 'ZNC', 'ALU'];
    
    // Get unique metals with their prices (for gold, only use 22K)
    const metalPrices = {};
    
    priceData.rows.forEach(row => {
      // Only include metals that are in the dropdown
      if (!availableMetals.includes(row.metal_name)) return;
      
      // Special handling for Gold - only use 22K carat
      if (row.metal_name === "XAU") {
        if (row.carat === "22" && row.price_1g) {
          metalPrices['XAU'] = row.price_1g;
        }
        return;
      }
      
      // For other metals, just take the first price
      if (!metalPrices[row.metal_name] && row.price_1g) {
        metalPrices[row.metal_name] = row.price_1g;
      }
    });

    // Build price table rows (in the order of availableMetals)
    const metalNames = {
      'XAU': 'Gold',
      'XAG': 'Silver',
      'XPT': 'Platinum',
      'XPD': 'Palladium',
      'XCU': 'Copper',
      'LEAD': 'Lead',
      'NI': 'Nickel',
      'ZNC': 'Zinc',
      'ALU': 'Aluminium'
    };

    let priceRows = '';
    availableMetals.forEach(metal => {
      const displayName = metalNames[metal];
      const price = metalPrices[metal];
      const priceDisplay = price ? `₹${price.toFixed(2)}` : 'N/A';
      priceRows += `
        <tr>
          <td style="padding: 12px; border: 1px solid #ddd;">${displayName}</td>
          <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${priceDisplay}</td>
        </tr>`;
    });

    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header with Logo and Branding -->
                <tr>
                  <td style="background: linear-gradient(135deg, #d4af37 0%, #f4e5c3 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: #2c3e50; font-size: 32px; font-weight: bold;">Auric Ledger</h1>
                    <p style="margin: 5px 0 0 0; color: #555; font-size: 14px;">Daily Metal Price Update</p>
                  </td>
                </tr>
                
                <!-- Date Section -->
                <tr>
                  <td style="padding: 30px;">
                    <h2 style="color: #d4af37; margin: 0 0 15px 0; font-size: 22px;">Market Update for ${dayjs().format("DD MMMM YYYY")}</h2>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #d4af37;">
                      <p style="margin: 0; color: #666; font-size: 14px;"><strong>USD to INR Exchange Rate:</strong> ₹${priceData.usdToInr.toFixed(2)}</p>
                    </div>
                  </td>
                </tr>
                
                <!-- Metal Prices Table -->
                <tr>
                  <td style="padding: 0 30px 30px 30px;">
                    <h3 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 20px;">Today's Metal Prices</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #ddd;">
                      <thead>
                        <tr style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);">
                          <th style="padding: 15px; text-align: left; color: #ffffff; font-size: 15px; border: 1px solid #ddd;">Metal</th>
                          <th style="padding: 15px; text-align: right; color: #ffffff; font-size: 15px; border: 1px solid #ddd;">Price per Gram</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${priceRows}
                      </tbody>
                    </table>
                    <p style="color: #888; font-size: 13px; margin: 15px 0 0 0; font-style: italic;">
                      * All prices are inclusive of import duty and GST, converted to INR
                    </p>
                  </td>
                </tr>
                
                <!-- Information Box -->
                <tr>
                  <td style="padding: 0 30px 30px 30px;">
                    <div style="background-color: #fff3cd; padding: 20px; border-radius: 6px; border: 1px solid #ffc107;">
                      <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                        <strong>Market Insights:</strong><br>
                        Prices are updated daily at 9:00 AM IST based on international market rates. 
                        Visit the app to set custom alerts and get notified when prices hit your target!
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #2c3e50; padding: 25px; text-align: center; border-radius: 0 0 8px 8px;">
                    <p style="margin: 0 0 10px 0; color: #ecf0f1; font-size: 14px;">
                      Manage your subscription preferences anytime in the app
                    </p>
                    <a href="https://auric-ledger.vercel.app" style="display: inline-block; padding: 12px 30px; background-color: #d4af37; color: #2c3e50; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; margin-top: 10px;">
                      Visit Auric Ledger
                    </a>
                    <p style="margin: 20px 0 0 0; color: #95a5a6; font-size: 12px;">
                      © 2026 Auric Ledger. All rights reserved.<br>
                      <strong>Your trusted source for precious metals pricing.</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email to all subscribers
    console.log(`📧 Sending emails to ${subscriptions.length} subscriber(s)...`);
    let successCount = 0;
    
    for (const subscription of subscriptions) {
      try {
        // Send daily price email to all subscribers
        await emailTransporter.sendMail({
          from: EMAIL_FROM,
          to: subscription.email,
          subject: `💎 Daily Metals Update - ${dayjs().format("DD MMM YYYY")} | Auric Ledger`,
          html: emailContent
        });
        if (verboseEmailLogs) {
          console.log(`✅ Email sent to ${subscription.email}`);
        }
        successCount++;
      } catch (sendError) {
        console.error(`❌ Failed to send email to ${subscription.email}:`, sendError.message);
      }
    }
    console.log(`📊 Email Summary: ${successCount}/${subscriptions.length} daily sent successfully`);
  } catch (error) {
    console.error("❌ Error in sendDailyPriceEmails:", error.message);
  }
};

// Function to send pending welcome emails (runs every 5 minutes)
const sendPendingWelcomeEmails = async () => {
  if (!emailTransporter) {
    return;
  }

  try {
    // Fetch subscriptions where welcome_sent_at is NULL (not yet sent)
    const { data: subscriptions, error } = await supabase
      .from("price_email_subscriptions")
      .select("email, subscribed_at, welcome_sent_at")
      .is("welcome_sent_at", null);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return; // No pending welcomes
    }

    console.log(`📧 Found ${subscriptions.length} pending welcome email(s)`);

    for (const subscription of subscriptions) {
      try {
        // Get latest prices for welcome email
        const { rows, latestDate } = await getLatestRows({});
        const usdToInr = await getUsdToInrRate();
        
        // Send welcome email
        await sendWelcomeEmail(subscription.email, { rows, usdToInr, date: latestDate });
        
        // Mark as sent
        const { error: updateError } = await supabase
          .from("price_email_subscriptions")
          .update({ welcome_sent_at: new Date().toISOString() })
          .eq("email", subscription.email);

        if (updateError) {
          console.error(`⚠️ Failed to mark welcome sent for ${subscription.email}:`, updateError.message);
        } else {
          console.log(`🎉 Welcome email sent to ${subscription.email}`);
        }
      } catch (sendError) {
        console.error(`❌ Failed to send welcome email to ${subscription.email}:`, sendError.message);
      }
    }
  } catch (error) {
    console.error("❌ Error in sendPendingWelcomeEmails:", error.message);
  }
};

const runDailyPipeline = async (sourceLabel = "cron") => {
  const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss");
  const verboseCronLogs = CRON_VERBOSE === "true";
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${timestamp}] Starting daily price fetch (${sourceLabel})...`);
  console.log(`${"=".repeat(60)}`);

  try {
    const result = await fetchAndStoreToday();

    console.log(`\n✅ SUCCESS - Daily price fetch completed`);
    console.log(`📅 Date: ${result.date}`);
    console.log(`💱 USD to INR: ${result.usdToInr}`);
    console.log(`📊 Total rows stored: ${result.rows.length}`);
    console.log(`\n🏷️  Metals processed:`);
    const metalCounts = result.rows.reduce((acc, row) => {
      acc[row.metal_name] = (acc[row.metal_name] || 0) + 1;
      return acc;
    }, {});
    Object.entries(metalCounts).forEach(([metal, count]) => {
      console.log(`   • ${metal}: ${count} row(s)`);
    });
    if (verboseCronLogs) {
      result.rows.forEach(row => {
        const caratInfo = row.carat ? ` (${row.carat}K)` : "";
        console.log(`     - ${row.metal_name}: ₹${row.price_1g?.toFixed(2) || "N/A"}/g${caratInfo}`);
      });
    }

    // Send daily price emails to subscribers
    console.log(`\n📧 Sending daily price emails...`);
    await sendDailyPriceEmails(result);

    // Send daily price updates to Telegram subscribers
    console.log(`\n📱 Sending daily price updates to Telegram...`);
    const metalPricesForTelegram = {};
    const availableMetals = ["XAU", "XAG", "XPT", "XPD", "XCU", "LEAD", "NI", "ZNC", "ALU"];

    result.rows.forEach(row => {
      if (!availableMetals.includes(row.metal_name)) return;

      if (row.metal_name === "XAU") {
        if (row.carat === "22" && row.price_1g) {
          metalPricesForTelegram.XAU = row.price_1g;
        }
        return;
      }

      if (!metalPricesForTelegram[row.metal_name] && row.price_1g) {
        metalPricesForTelegram[row.metal_name] = row.price_1g;
      }
    });

    await sendDailyPricesToTelegram(metalPricesForTelegram);

    console.log(`\n${"=".repeat(60)}\n`);
    return {
      date: result.date,
      usdToInr: result.usdToInr,
      totalRows: result.rows.length
    };
  } catch (error) {
    console.error(`\n❌ FAILED - Daily price fetch failed`);
    console.error(`📅 Time: ${timestamp}`);
    console.error(`⚠️  Error: ${error.message}`);
    if (error.stack) {
      console.error(`\n📋 Stack trace:\n${error.stack}`);
    }
    console.error(`${"=".repeat(60)}\n`);
    throw error;
  }
};

// Endpoint to keep Render service awake (prevent sleep on free tier)
// Called by cron-job.org every 1 minute
app.get("/wake-up", (req, res) => {
  const timestamp = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
  console.log(`⏰ Wake-up ping received at ${timestamp}`);
  res.json({ status: "awake", timestamp });
});

app.post("/run-daily", async (req, res) => {
  try {
    if (!RUN_DAILY_SECRET) {
      return res.status(500).json({ status: "error", message: "RUN_DAILY_SECRET is not configured" });
    }

    const providedSecret = req.header("x-run-daily-secret");
    if (providedSecret !== RUN_DAILY_SECRET) {
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    const result = await runDailyPipeline("cron-job.org");
    res.json({ status: "ok", ...result });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Daily job failed" });
  }
});

// Background cron: Send pending welcome emails every 5 minutes
// (Triggered by external cron-job.org, not internal)
app.post("/send-welcome-emails", async (req, res) => {
  try {
    if (!RUN_WELCOME_EMAIL_SECRET) {
      return res.status(500).json({ status: "error", message: "RUN_WELCOME_EMAIL_SECRET is not configured" });
    }

    const providedSecret = req.header("x-send-welcome-emails-secret");
    if (providedSecret !== RUN_WELCOME_EMAIL_SECRET) {
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    const result = await sendPendingWelcomeEmails();
    res.json({ status: "ok", ...result });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Welcome email job failed" });
  }
});

if (CRON_ENABLED === "true") {
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      await runDailyPipeline("cron");
    } catch (error) {
      // Errors already logged in runDailyPipeline
    }
  }, { timezone: "Asia/Kolkata" });
} else {
  console.log("⏸️  Cron scheduling disabled (CRON_ENABLED=false)");
}

// Try multiple ports in order: 4000, PORT from env (Render), 4001, 4002, etc.
const tryPorts = [4000, PORT, 4001, 4002, 4003, 5000];
const uniquePorts = [...new Set(tryPorts)].filter(p => p && !isNaN(p));

const startServer = (ports, index = 0) => {
  if (index >= ports.length) {
    console.error("❌ Could not find an available port to start server");
    process.exit(1);
  }

  const port = ports[index];
  const server = app.listen(port)
    .on('listening', () => {
      console.log(`\n✅ API listening on port ${port}`);
      console.log(`📱 Telegram bot started successfully`);
      console.log(`⏰ Wake-up ping: GET /wake-up (cron-job.org every 1 min - keeps service awake)`);
      console.log(`📧 Email service: Brevo API (reliable on Render free tier)`);
      console.log(`⏰ Daily cron job: POST /run-daily (9 AM Asia/Kolkata)`);
      console.log(`📧 Welcome emails: POST /send-welcome-emails (cron-job.org every 5 min)`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Port ${port} is already in use, trying next port...`);
        startServer(ports, index + 1);
      } else {
        console.error(`❌ Error starting server:`, err);
        process.exit(1);
      }
    });
};

startServer(uniquePorts);
