import express from "express";
import cors from "cors";
import axios from "axios";
import cron from "node-cron";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import dotenv from "dotenv";
import helmet from "helmet";
import { body, validationResult } from "express-validator";
import { createClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";
import { sendDailyPricesToTelegram } from "./telegram-bot.js";
import bot from "./telegram-bot.js";
import { askChatbot, streamChatbot } from "./chatbot.js";

dotenv.config();
dayjs.extend(utc);
dayjs.extend(timezone);

const app = express();
app.set("trust proxy", 1);

// ============================================
// SECURITY: Helmet - Protect HTTP Headers
// ============================================
// Helmet helps secure Express.js apps by setting various HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,          // Prevent MIME type sniffing
  xssFilter: true,         // Enable XSS filter
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" }, // Prevent clickjacking
}));

// ============================================
// SECURITY: Request Sanitization & Logging
// ============================================
// Utility function to mask sensitive data in logs
const maskSensitiveData = (text) => {
  if (!text) return text;
  
  // Mask API keys (don't show full keys)
  text = String(text).replace(/xkeysib-[a-zA-Z0-9-]+/g, "xkeysib-***");
  text = text.replace(/sk_[a-zA-Z0-9]+/g, "sk_***");
  text = text.replace(/[a-zA-Z0-9]+_[a-zA-Z0-9]{40,}/g, "***SECRET***");
  
  // Keep first 3 and last 3 chars of email for logging
  text = text.replace(/([a-zA-Z0-9]{3})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+)/g, "$1***@$2");
  
  return text;
};

// Middleware: Log requests securely (without sensitive data)
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const safeBody = maskSensitiveData(JSON.stringify(req.body));
    console.log(`[${req.method}] ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// ============================================
// SECURITY: CORS - Restrict to only your domain
// ============================================
const ALLOWED_ORIGINS = [
  "https://metal-price.onrender.com",
  "https://auric--ledger.vercel.app",
  "http://localhost:3000", // For local development
  "http://localhost:5173"  // For Vite dev server
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-run-daily-secret", "x-send-welcome-emails-secret", "x-generate-summary-secret"]
}));

// ============================================
// SECURITY: Request Body Size Limits
// ============================================
// Prevent huge payloads that could crash server or be used in DoS attacks
app.use(express.json({ 
  limit: "10kb"  // Max 10KB per request body
}));
app.use(express.urlencoded({ 
  limit: "10kb",
  extended: true 
}));

// Timeout for slow clients (prevent slowloris attacks)
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 second timeout per request
  next();
});

// ============================================
// SECURITY: Rate Limiting - Prevent spam
// ============================================

// General rate limiter (all requests)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per IP per window
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't rate limit internal cron calls (they should have secret headers)
    return req.headers["x-run-daily-secret"] || req.headers["x-send-welcome-emails-secret"] || req.headers["x-generate-summary-secret"];
  }
});

// Stricter limiter for email endpoints
const emailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 email requests per IP per minute
  message: "Too many email requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter limiter for auth-like endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 requests per IP per window
  message: "Too many attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});

// Apply general rate limiter to all routes
app.use(generalLimiter);

// ============================================
// SECURITY: Remove Sensitive Response Headers
// ============================================
// Hide technology stack from attackers
app.use((req, res, next) => {
  // Remove headers that expose server technology
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");
  res.removeHeader("X-AspNet-Version");
  res.removeHeader("X-Runtime");
  
  // Add security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  next();
});

// ============================================
// SECURITY: Email Validation Function
// ============================================
const isValidEmail = (email) => {
  // RFC 5322 simplified email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// ============================================
// SECURITY: Error Response Handler
// ============================================
// Generic error response (doesn't expose system details)
const sendErrorResponse = (res, statusCode, message = "An error occurred") => {
  console.error(`[ERROR ${statusCode}] ${message}`);
  res.status(statusCode).json({
    status: "error",
    message: message
  });
};

// Success response wrapper
const sendSuccessResponse = (res, data) => {
  res.json({ status: "success", ...data });
};

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
  RUN_WELCOME_EMAIL_SECRET,
  GENERATE_SUMMARY_SECRET
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
  EMAIL_USER,
  EMAIL_FROM = EMAIL_USER,
  BREVO_API_KEY
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
      sender: { email: EMAIL_FROM, name: "Auric Ledger" },
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

// Preserve current day's prices as yesterday (runs at 8:55 AM IST, before the 9:00 AM price fetch)
const preserveYesterdayPrices = async () => {
  const today = dayjs().format("YYYY-MM-DD");
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
  
  try {
    // Fetch today's prices (latest) from the database
    const { data: todaysPrices, error: fetchError } = await supabase
      .from("metal_prices")
      .select("*")
      .eq("date", today);
    
    if (fetchError) throw fetchError;
    
    // If today's prices exist, we need to update yesterday's records
    if (todaysPrices && todaysPrices.length > 0) {
      // Delete old yesterday's prices to avoid duplicates
      const { error: deleteError } = await supabase
        .from("metal_prices")
        .delete()
        .eq("date", yesterday);
      
      if (deleteError) {
        console.warn("⚠️  Could not delete old yesterday prices:", deleteError.message);
      }
      
      // Create yesterday's price records by copying today's with yesterday's date
      const yesterdayRows = todaysPrices.map(({ id, ...row }) => ({
        ...row,
        date: yesterday,
        created_at: new Date().toISOString()
      }));
      
      const { data, error: insertError } = await supabase
        .from("metal_prices")
        .insert(yesterdayRows)
        .select();
      
      if (insertError) throw insertError;
      
      console.log(`✅ Preserved ${yesterdayRows.length} price records as yesterday's prices`);
      return { status: "success", count: yesterdayRows.length };
    } else {
      console.log("⚠️  No today's prices found to preserve as yesterday");
      return { status: "no_data", count: 0 };
    }
  } catch (error) {
    console.error("❌ Failed to preserve yesterday's prices:", error.message);
    throw error;
  }
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
  
  // If we don't have 2 unique dates, at least return today's price
  if (uniqueData.length === 0) return null;
  
  const today = uniqueData[0];
  const yesterday = uniqueData[1];

  return {
    metal_name: metal,
    today_date: today.date,
    yesterday_date: yesterday?.date || today.date,
    today_prices: {
      price_1g: today.price_1g,
      price_8g: today.price_8g,
      price_per_kg: today.price_per_kg
    },
    yesterday_prices: {
      price_1g: yesterday?.price_1g || today.price_1g,
      price_8g: yesterday?.price_8g || today.price_8g,
      price_per_kg: yesterday?.price_per_kg || today.price_per_kg
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
app.post("/subscribe-email", emailLimiter, [
  // Input validation and sanitization
  body("email")
    .trim()                    // Remove leading/trailing whitespace
    .toLowerCase()             // Convert to lowercase
    .isEmail()                 // Validate email format
    .normalizeEmail()          // Normalize email
    .withMessage("Invalid email format"),
  
  body("*")                    // Reject any unexpected fields
    .custom((value, { req }) => {
      const allowedFields = ["email"];
      const requestFields = Object.keys(req.body);
      const hasUnexpectedFields = requestFields.some(f => !allowedFields.includes(f));
      
      if (hasUnexpectedFields) {
        throw new Error("Unexpected fields in request");
      }
      return true;
    })
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid email format" 
      });
    }

    const { email } = req.body;
    
    // Additional email validation (RFC 5322)
    if (!isValidEmail(email)) {
      return res.status(400).json({ status: "error", message: "Invalid email format" });
    }

    // Ensure table exists
    const { data: existing, error: fetchError } = await supabase
      .from("price_email_subscriptions")
      .select("id")
      .eq("email", email)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Database query error:", fetchError.message);
      return sendErrorResponse(res, 500, "An error occurred. Please try again later.");
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
      console.error("Database insert/update error:", result.error.message);
      return sendErrorResponse(res, 500, "An error occurred. Please try again later.");
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

let lastPipelineRunDate = null;

const runDailyPipeline = async (sourceLabel = "cron") => {
  const todayStr = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD");
  if (lastPipelineRunDate === todayStr) {
    console.log(`⚠️  Daily pipeline already ran today (${todayStr}), skipping duplicate from ${sourceLabel}`);
    return { date: todayStr, skipped: true };
  }
  lastPipelineRunDate = todayStr;

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
    // Reset guard so a retry can run today
    lastPipelineRunDate = null;
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

// ============================================
// DAILY AI SUMMARY — Generate & Fetch
// ============================================

// POST /generate-daily-summary — Called by cron-job.org at 9:01 AM IST
// Background worker for summary generation (runs after immediate response)
const generateSummaryInBackground = async (today) => {
  try {
    // Fetch today's prices (all metals)
    const { data: todayPrices, error: todayErr } = await supabase
      .from("metal_prices")
      .select("metal_name, price_1g, price_8g, price_per_kg, carat, date")
      .eq("date", today);

    if (todayErr) {
      console.error("❌ Error fetching today's prices:", todayErr.message);
      return;
    }

    if (!todayPrices || todayPrices.length === 0) {
      console.warn("⚠️ No prices found for today, skipping summary generation");
      return;
    }

    // Fetch yesterday's prices for comparison
    const yesterday = dayjs(today).subtract(1, "day").format("YYYY-MM-DD");
    const { data: yesterdayPrices } = await supabase
      .from("metal_prices")
      .select("metal_name, price_1g, price_8g, price_per_kg, carat, date")
      .eq("date", yesterday);

    // Build price data text for the prompt
    const formatPriceData = (rows, label) => {
      if (!rows || rows.length === 0) return `${label}: No data available`;
      const lines = [`${label}:`];
      const metals = {};
      rows.forEach(row => {
        if (row.metal_name === "XAU") {
          if (!metals.XAU) metals.XAU = {};
          if (row.carat && row.price_1g) {
            metals.XAU[row.carat] = { price_1g: row.price_1g, price_8g: row.price_8g };
          }
        } else if (row.price_1g) {
          metals[row.metal_name] = { price_1g: row.price_1g, price_per_kg: row.price_per_kg };
        }
      });

      // Format Gold
      if (metals.XAU) {
        ["24", "22", "18"].forEach(c => {
          if (metals.XAU[c]) {
            lines.push(`Gold ${c}K: ₹${metals.XAU[c].price_1g.toFixed(2)} per gram, ₹${metals.XAU[c].price_8g.toFixed(2)} per 8g`);
          }
        });
      }

      // Format other metals
      const metalNames = { XAG: "Silver", XPT: "Platinum", XPD: "Palladium", XCU: "Copper", LEAD: "Lead", NI: "Nickel", ZNC: "Zinc", ALU: "Aluminium" };
      Object.entries(metalNames).forEach(([sym, name]) => {
        if (metals[sym]) {
          const perKg = metals[sym].price_per_kg ? `, ₹${metals[sym].price_per_kg.toFixed(2)} per kg` : "";
          lines.push(`${name}: ₹${metals[sym].price_1g.toFixed(2)} per gram${perKg}`);
        }
      });

      return lines.join("\n");
    };

    const todayData = formatPriceData(todayPrices, `Today's Prices (${today})`);
    const yesterdayData = formatPriceData(yesterdayPrices, `Yesterday's Prices (${yesterday})`);

    // Build the summary prompt
    const summaryPrompt = `You are a professional Indian market analyst writing a daily metal price summary for Auric Ledger.

${todayData}

${yesterdayData}

Write a detailed daily market summary covering ALL metals listed above. For each metal:
- State today's price in ₹ (Indian Rupees)
- Compare with yesterday and mention if price went UP, DOWN, or stayed UNCHANGED
- Include the exact change amount in ₹

Format rules:
- Use ₹ symbol always, NEVER use $ or USD
- Start with a one-line market overview
- Then list each metal with its price and change
- End with a brief outlook or observation
- Use bullet points or clear sections for readability
- Keep it professional but easy to understand
- Include Gold (all carats: 24K, 22K, 18K), Silver, Platinum, Palladium, Copper, Lead, Nickel, Zinc, and Aluminium
- Be concise but thorough — cover every metal`;

    // Call HF model
    const HF_API_URL = "https://valtry-auric-bot.hf.space/v1/chat/completions";
    const hfResponse = await axios.post(
      HF_API_URL,
      {
        model: "auric-ai",
        stream: false,
        messages: [
          { role: "system", content: "You are a professional Indian metal market analyst. Write detailed, accurate market summaries using only the data provided. All prices must be in Indian Rupees (₹)." },
          { role: "user", content: summaryPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      },
      { headers: { "Content-Type": "application/json" }, timeout: 180000 }
    );

    const summary = hfResponse.data?.choices?.[0]?.message?.content;
    if (!summary) {
      console.error("❌ Empty response from HF model");
      return;
    }

    // Upsert into daily_summaries table
    const { error: upsertErr } = await supabase
      .from("daily_summaries")
      .upsert(
        { date: today, summary, created_at: new Date().toISOString() },
        { onConflict: "date" }
      );

    if (upsertErr) {
      console.error("❌ Error saving summary:", upsertErr.message);
      return;
    }

    console.log(`✅ Daily summary generated and saved for ${today}`);
  } catch (error) {
    console.error("❌ Background summary generation error:", error.message);
  }
};

app.post("/generate-daily-summary", authLimiter, async (req, res) => {
  try {
    if (!GENERATE_SUMMARY_SECRET) {
      console.error("❌ GENERATE_SUMMARY_SECRET is not configured");
      return sendErrorResponse(res, 500, "Service not properly configured");
    }

    const providedSecret = req.header("x-generate-summary-secret");
    if (!providedSecret || providedSecret !== GENERATE_SUMMARY_SECRET) {
      console.warn("⚠️ Unauthorized /generate-daily-summary access attempt");
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const today = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD");
    console.log(`📊 Generating daily summary for ${today}...`);

    // Respond immediately so cron-job.org doesn't timeout
    res.json({ status: "accepted", message: "Summary generation started", date: today });

    // Run generation in background (after response is sent)
    generateSummaryInBackground(today);
  } catch (error) {
    console.error("❌ Generate summary error:", error.message);
    if (!res.headersSent) {
      return sendErrorResponse(res, 500, "Summary generation failed");
    }
  }
});

// GET /daily-summary — Public endpoint to fetch the latest summary
app.get("/daily-summary", generalLimiter, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("daily_summaries")
      .select("date, summary, created_at")
      .order("date", { ascending: false })
      .limit(1);

    if (error) {
      console.error("❌ Error fetching daily summary:", error.message);
      return sendErrorResponse(res, 500, "Failed to fetch summary");
    }

    if (!data || data.length === 0) {
      return res.json({ status: "success", date: null, summary: null });
    }

    res.json({ status: "success", date: data[0].date, summary: data[0].summary, created_at: data[0].created_at });
  } catch (error) {
    console.error("❌ Daily summary fetch error:", error.message);
    return sendErrorResponse(res, 500, "Failed to fetch summary");
  }
});

app.post("/run-daily", authLimiter, async (req, res) => {
  try {
    if (!RUN_DAILY_SECRET) {
      console.error("❌ RUN_DAILY_SECRET is not configured");
      return sendErrorResponse(res, 500, "Service not properly configured");
    }

    const providedSecret = req.header("x-run-daily-secret");
    if (!providedSecret || providedSecret !== RUN_DAILY_SECRET) {
      console.warn("⚠️ Unauthorized /run-daily access attempt");
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const result = await runDailyPipeline("cron-job.org");
    res.json({ status: "ok", ...result });
  } catch (error) {
    console.error("❌ Daily job error:", error.message);
    return sendErrorResponse(res, 500, "Daily job failed");
  }
});

app.post("/preserve-yesterday", authLimiter, async (req, res) => {
  try {
    const preserveSecret = process.env.PRESERVE_YESTERDAY_SECRET;
    if (!preserveSecret) {
      console.error("❌ PRESERVE_YESTERDAY_SECRET is not configured");
      return sendErrorResponse(res, 500, "Service not properly configured");
    }

    const providedSecret = req.header("x-preserve-yesterday-secret");
    if (!providedSecret || providedSecret !== preserveSecret) {
      console.warn("⚠️ Unauthorized /preserve-yesterday access attempt");
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const result = await preserveYesterdayPrices();
    res.json({ status: "ok", ...result });
  } catch (error) {
    console.error("❌ Preserve yesterday job error:", error.message);
    return sendErrorResponse(res, 500, "Preserve yesterday job failed");
  }
});

// Background cron: Send pending welcome emails every 5 minutes
// (Triggered by external cron-job.org, not internal)
app.post("/send-welcome-emails", authLimiter, async (req, res) => {
  try {
    if (!RUN_WELCOME_EMAIL_SECRET) {
      console.error("❌ RUN_WELCOME_EMAIL_SECRET is not configured");
      return sendErrorResponse(res, 500, "Service not properly configured");
    }

    const providedSecret = req.header("x-send-welcome-emails-secret");
    if (!providedSecret || providedSecret !== RUN_WELCOME_EMAIL_SECRET) {
      console.warn("⚠️ Unauthorized /send-welcome-emails access attempt");
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const result = await sendPendingWelcomeEmails();
    res.json({ status: "ok", ...result });
  } catch (error) {
    console.error("❌ Welcome email job error:", error.message);
    return sendErrorResponse(res, 500, "Welcome email job failed");
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

  // Preserve yesterday's prices at 8:55 AM IST (5 minutes before daily fetch at 9:00 AM)
  cron.schedule("55 8 * * *", async () => {
    try {
      const timestamp = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
      console.log(`\n⏳ [${timestamp}] Starting to preserve yesterday's prices...`);
      const result = await preserveYesterdayPrices();
      console.log(`✅ [${timestamp}] Successfully preserved yesterday's prices (${result.count} records)\n`);
    } catch (error) {
      const timestamp = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
      console.error(`❌ [${timestamp}] Failed to preserve yesterday's prices:`, error.message);
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

// ============================================
// AI Chatbot Endpoint
// ============================================
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 chat requests per IP per minute
  message: "Too many chat requests, please slow down",
  standardHeaders: true,
  legacyHeaders: false
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  try {
    const { message, stream } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ status: "error", message: "Message is required" });
    }
    if (message.length > 500) {
      return res.status(400).json({ status: "error", message: "Message too long (max 500 chars)" });
    }

    if (stream) {
      // Streaming SSE response
      await streamChatbot(message.trim(), res);
    } else {
      // Non-streaming JSON response
      const result = await askChatbot(message.trim());
      res.json({ status: "success", reply: result.answer });
    }
  } catch (error) {
    console.error("Chat endpoint error:", error);
    if (!res.headersSent) {
      res.status(500).json({ status: "error", message: "Failed to process chat request" });
    }
  }
});

// ============================================
// SECURITY: Global Error Handler
// ============================================
// Must be last middleware to catch all errors
app.use((err, req, res, next) => {
  // Log error securely (mask sensitive data)
  const safeMessage = maskSensitiveData(err.message);
  console.error(`[ERROR] ${safeMessage}`);
  
  // Don't expose stack trace or internal details to client
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";
  
  if (isProduction) {
    // Production: Generic error message
    res.status(statusCode).json({
      status: "error",
      message: "An error occurred. Please try again later."
    });
  } else {
    // Development: More details for debugging
    res.status(statusCode).json({
      status: "error",
      message: safeMessage
    });
  }
});

// ============================================
// SECURITY: 404 Handler - Don't expose route structure
// ============================================
app.use((req, res) => {
  console.warn(`⚠️ Unknown route accessed: ${req.method} ${req.path}`);
  res.status(404).json({
    status: "error",
    message: "Endpoint not found"
  });
});

startServer(uniquePorts);
