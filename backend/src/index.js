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
  GENERATE_SUMMARY_SECRET,
  NEWS_API_KEY,
  RUN_NEWS_SECRET,
  GROQ_API_KEY
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

// ============================================
// NEWS — Stored in Supabase, fetched by daily cron
// ============================================

// GET /news-articles — Public: reads from Supabase news_articles table
app.get("/news-articles", generalLimiter, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("news_articles")
      .select("*")
      .order("published_at", { ascending: false });

    if (error) {
      console.error("News DB read error:", error.message);
      return res.status(500).json({ error: "Failed to fetch news" });
    }

    // Map DB columns back to the camelCase shape the frontend expects
    const articles = (data || []).map((row) => ({
      title: row.title,
      description: row.description,
      content: row.content,
      url: row.url,
      urlToImage: row.url_to_image,
      publishedAt: row.published_at,
      source: { name: row.source_name },
      author: row.author,
    }));

    res.json({ articles, totalResults: articles.length });
  } catch (err) {
    console.error("News endpoint error:", err.message);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// POST /fetch-news — Cron endpoint: fetches from NewsAPI, replaces DB rows
app.post("/fetch-news", authLimiter, async (req, res) => {
  try {
    if (!RUN_NEWS_SECRET) {
      console.error("RUN_NEWS_SECRET is not configured");
      return sendErrorResponse(res, 500, "Service not properly configured");
    }

    const providedSecret = req.header("x-run-news-secret");
    if (!providedSecret || providedSecret !== RUN_NEWS_SECRET) {
      console.warn("Unauthorized /fetch-news access attempt");
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    if (!NEWS_API_KEY) {
      return sendErrorResponse(res, 500, "NEWS_API_KEY not configured");
    }

    const timestamp = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[${timestamp}] Starting daily news fetch...`);
    console.log(`${"=".repeat(60)}`);

    // Fetch news from NewsAPI (max 100 per page on free plan)
    const fromDate = dayjs().subtract(7, "day").format("YYYY-MM-DD");
    const response = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        q: '"precious metals" OR gold OR silver OR platinum OR palladium',
        searchIn: "title,description",
        language: "en",
        sortBy: "publishedAt",
        pageSize: 100,
        from: fromDate,
        apiKey: NEWS_API_KEY,
      },
      timeout: 15000,
    });

    const rawArticles = response.data?.articles || [];
    console.log(`Fetched ${rawArticles.length} raw articles from NewsAPI`);

    // Filter out bad articles
    const articles = rawArticles.filter(
      (a) => a.title && a.title !== "[Removed]" && a.urlToImage
    );
    console.log(`${articles.length} articles after filtering`);

    // Step 1: Delete all existing news articles
    const { error: deleteError } = await supabase
      .from("news_articles")
      .delete()
      .neq("id", 0); // delete all rows

    if (deleteError) {
      console.error("Failed to delete old news:", deleteError.message);
      return sendErrorResponse(res, 500, "Failed to clear old news");
    }
    console.log("Old news articles deleted");

    // Step 2: Insert new articles
    if (articles.length > 0) {
      const rows = articles.map((a) => ({
        title: a.title,
        description: a.description || null,
        content: a.content || null,
        url: a.url,
        url_to_image: a.urlToImage || null,
        published_at: a.publishedAt || null,
        source_name: a.source?.name || "Unknown",
        author: a.author || null,
      }));

      const { error: insertError } = await supabase
        .from("news_articles")
        .insert(rows);

      if (insertError) {
        console.error("Failed to insert news:", insertError.message);
        return sendErrorResponse(res, 500, "Failed to store news articles");
      }
    }

    console.log(`Successfully stored ${articles.length} news articles`);
    console.log(`${"=".repeat(60)}\n`);

    res.json({
      status: "ok",
      articlesStored: articles.length,
      rawFetched: rawArticles.length,
      timestamp,
    });
  } catch (error) {
    console.error("News fetch cron error:", error.message);
    return sendErrorResponse(res, 500, "News fetch failed");
  }
});

// GET /fetch-news — GET version for external cron services
app.get("/fetch-news", async (req, res) => {
  try {
    const secret = req.query.secret || req.header("x-run-news-secret");
    if (!RUN_NEWS_SECRET || !secret || secret !== RUN_NEWS_SECRET) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    if (!NEWS_API_KEY) {
      return sendErrorResponse(res, 500, "NEWS_API_KEY not configured");
    }

    const timestamp = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[${timestamp}] Starting daily news fetch (GET)...`);
    console.log(`${"=".repeat(60)}`);

    const fromDate = dayjs().subtract(7, "day").format("YYYY-MM-DD");
    const response = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        q: '"precious metals" OR gold OR silver OR platinum OR palladium',
        searchIn: "title,description",
        language: "en",
        sortBy: "publishedAt",
        pageSize: 100,
        from: fromDate,
        apiKey: NEWS_API_KEY,
      },
      timeout: 15000,
    });

    const rawArticles = response.data?.articles || [];
    const articles = rawArticles.filter(
      (a) => a.title && a.title !== "[Removed]" && a.urlToImage
    );

    const { error: deleteError } = await supabase
      .from("news_articles")
      .delete()
      .neq("id", 0);

    if (deleteError) {
      return sendErrorResponse(res, 500, "Failed to clear old news");
    }

    if (articles.length > 0) {
      const rows = articles.map((a) => ({
        title: a.title,
        description: a.description || null,
        content: a.content || null,
        url: a.url,
        url_to_image: a.urlToImage || null,
        published_at: a.publishedAt || null,
        source_name: a.source?.name || "Unknown",
        author: a.author || null,
      }));

      const { error: insertError } = await supabase
        .from("news_articles")
        .insert(rows);

      if (insertError) {
        return sendErrorResponse(res, 500, "Failed to store news articles");
      }
    }

    console.log(`Stored ${articles.length} news articles (GET)`);
    console.log(`${"=".repeat(60)}\n`);

    res.json({
      status: "ok",
      articlesStored: articles.length,
      rawFetched: rawArticles.length,
      timestamp,
    });
  } catch (error) {
    console.error("News fetch GET error:", error.message);
    return sendErrorResponse(res, 500, "News fetch failed");
  }
});

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
      // Group by metal_name, prefer the base (non-carat) row for each metal
      const metalMap = {};
      for (const row of rows) {
        const existing = metalMap[row.metal_name];
        // Prefer non-carat row, or first seen row
        if (!existing || (existing.carat && !row.carat)) {
          metalMap[row.metal_name] = row;
        }
      }
      let metals = Object.values(metalMap).map((row) => ({
        metal_name: row.metal_name,
        price_1g: row.price_1g,
        price_8g: row.price_8g,
        price_per_kg: row.price_per_kg,
        date: row.date
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
  
  body("username")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Username too long"),

  body("*")                    // Reject any unexpected fields
    .custom((value, { req }) => {
      const allowedFields = ["email", "username"];
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

    const { email, username } = req.body;
    
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
const sendWelcomeEmail = async (email, priceData, username) => {
  if (!emailTransporter) return;

  const displayName = username || "Subscriber";
  const logoUrl = "https://auric--ledger.vercel.app/metal-price-icon.svg";

  // Available metals in dropdown (matching frontend dropdown)
  const availableMetals = ['XAU', 'XAG', 'XPT', 'XPD', 'XCU', 'LEAD', 'NI', 'ZNC', 'ALU'];
  const metalNames = {
    'XAU': 'Gold', 'XAG': 'Silver', 'XPT': 'Platinum', 'XPD': 'Palladium',
    'XCU': 'Copper', 'LEAD': 'Lead', 'NI': 'Nickel', 'ZNC': 'Zinc', 'ALU': 'Aluminium'
  };

  // Collect prices
  const metalPrices = {};
  const goldCaratPrices = {};

  priceData.rows.forEach(row => {
    if (!availableMetals.includes(row.metal_name)) return;
    if (row.metal_name === "XAU") {
      if (row.carat && row.price_1g) goldCaratPrices[row.carat] = row.price_1g;
      if (row.carat === "22" && row.price_1g) metalPrices['XAU'] = row.price_1g;
      return;
    }
    if (!metalPrices[row.metal_name] && row.price_1g) metalPrices[row.metal_name] = row.price_1g;
  });

  // Build gold carat rows
  let goldRows = "";
  ["24", "22", "18"].forEach((c, i) => {
    if (!goldCaratPrices[c]) return;
    const bgColor = i % 2 === 0 ? "#fffdf5" : "#ffffff";
    goldRows += `
      <tr style="background-color: ${bgColor};">
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0ecdf; color: #5a5a5a; font-size: 14px;">${c}K Gold</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0ecdf; text-align: right; font-weight: 700; color: #2c3e50; font-size: 15px;">₹${goldCaratPrices[c].toFixed(2)}</td>
      </tr>`;
  });

  // Build price table rows
  let priceRows = "";
  let isAlt = false;
  availableMetals.forEach(metal => {
    const price = metalPrices[metal];
    const bgColor = isAlt ? "#f8f6f0" : "#ffffff";
    priceRows += `
      <tr style="background-color: ${bgColor};">
        <td style="padding: 12px 16px; border-bottom: 1px solid #e8e4db; font-weight: 600; color: #2c3e50; font-size: 14px;">${metalNames[metal]}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e8e4db; text-align: right; font-weight: 700; color: #2c3e50; font-size: 15px;">${price ? `₹${price.toFixed(2)}` : "N/A"}</td>
      </tr>`;
    isAlt = !isAlt;
  });

  const emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #eae6dd;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eae6dd; padding: 20px 10px;">
        <tr>
          <td align="center">
            <table width="640" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); overflow: hidden;">
              
              <!-- Premium Welcome Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 40px 30px 32px 30px; text-align: center;">
                  <img src="${logoUrl}" alt="AL" width="52" height="52" style="display: block; margin: 0 auto 16px auto; border-radius: 50%;" />
                  <h1 style="margin: 0; color: #d4af37; font-size: 34px; font-weight: 700; letter-spacing: 1px;">Auric Ledger</h1>
                  <div style="display: inline-block; padding: 6px 20px; border: 1px solid #d4af37; border-radius: 50px; margin-top: 14px;">
                    <span style="color: #d4af37; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; font-weight: 600;">Welcome Aboard</span>
                  </div>
                  <p style="margin: 12px 0 0 0; color: #8892b0; font-size: 12px; letter-spacing: 1px;">${dayjs().format("dddd, DD MMMM YYYY")}</p>
                </td>
              </tr>

              <!-- Personal Greeting -->
              <tr>
                <td style="padding: 32px 28px 0 28px;">
                  <h2 style="margin: 0 0 12px 0; color: #1a1a2e; font-size: 24px; font-weight: 700;">Hello, ${displayName}!</h2>
                  <p style="margin: 0; color: #555; font-size: 15px; line-height: 1.7;">
                    Welcome to <strong style="color: #d4af37;">Auric Ledger</strong> — your personal gateway to real-time precious metals pricing in India.
                    We're thrilled to have you join our community of informed investors and market enthusiasts.
                  </p>
                </td>
              </tr>

              <!-- What You'll Receive -->
              <tr>
                <td style="padding: 28px 28px 0 28px;">
                  <h3 style="margin: 0 0 16px 0; color: #1a1a2e; font-size: 17px; font-weight: 700; letter-spacing: 0.5px;">
                    <span style="color: #d4af37;">&#9670;</span> What You'll Receive
                  </h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="32%" style="padding-right: 8px; vertical-align: top;">
                        <div style="background-color: #f8f6f0; padding: 20px 14px; border-radius: 10px; text-align: center; border: 1px solid #e8e4db;">
                          <p style="margin: 0 0 8px 0; font-size: 28px;">&#128202;</p>
                          <p style="margin: 0 0 4px 0; color: #1a1a2e; font-size: 13px; font-weight: 700;">Daily Reports</p>
                          <p style="margin: 0; color: #888; font-size: 11px; line-height: 1.4;">Every morning at 9:00 AM IST</p>
                        </div>
                      </td>
                      <td width="36%" style="padding: 0 4px; vertical-align: top;">
                        <div style="background-color: #f8f6f0; padding: 20px 14px; border-radius: 10px; text-align: center; border: 1px solid #e8e4db;">
                          <p style="margin: 0 0 8px 0; font-size: 28px;">&#128276;</p>
                          <p style="margin: 0 0 4px 0; color: #1a1a2e; font-size: 13px; font-weight: 700;">Price Alerts</p>
                          <p style="margin: 0; color: #888; font-size: 11px; line-height: 1.4;">Custom notifications at your target prices</p>
                        </div>
                      </td>
                      <td width="32%" style="padding-left: 8px; vertical-align: top;">
                        <div style="background-color: #f8f6f0; padding: 20px 14px; border-radius: 10px; text-align: center; border: 1px solid #e8e4db;">
                          <p style="margin: 0 0 8px 0; font-size: 28px;">&#128200;</p>
                          <p style="margin: 0 0 4px 0; color: #1a1a2e; font-size: 13px; font-weight: 700;">Market Insights</p>
                          <p style="margin: 0; color: #888; font-size: 11px; line-height: 1.4;">Charts, trends &amp; comparisons</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Gold Spotlight -->
              ${goldRows ? `
              <tr>
                <td style="padding: 28px 28px 0 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fffdf5 0%, #fef9e7 100%); border-radius: 10px; border: 1px solid #f0e6c8; overflow: hidden;">
                    <tr>
                      <td style="padding: 18px 20px 6px 20px;">
                        <p style="margin: 0; color: #b8860b; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">&#127942; Gold Prices Today</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 20px 14px 20px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                          ${goldRows}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>` : ""}

              <!-- All Metal Prices -->
              <tr>
                <td style="padding: 28px 28px 0 28px;">
                  <h3 style="margin: 0 0 14px 0; color: #1a1a2e; font-size: 17px; font-weight: 700; letter-spacing: 0.5px;">
                    <span style="color: #d4af37;">&#9670;</span> Today's Metal Prices
                  </h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e8e4db;">
                    <tr style="background: linear-gradient(90deg, #1a1a2e, #16213e);">
                      <th style="padding: 12px 16px; text-align: left; color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Metal</th>
                      <th style="padding: 12px 16px; text-align: right; color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Price per Gram</th>
                    </tr>
                    ${priceRows}
                  </table>
                  <p style="color: #999; font-size: 11px; margin: 10px 0 0 0; font-style: italic;">
                    * Prices include import duty &amp; GST, converted to INR
                  </p>
                </td>
              </tr>

              <!-- Exchange Rate -->
              <tr>
                <td style="padding: 20px 28px 0 28px;">
                  <div style="background-color: #f8f6f0; padding: 14px 20px; border-radius: 8px; border: 1px solid #e8e4db;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #666; font-size: 13px;">USD to INR Exchange Rate</td>
                        <td style="text-align: right; color: #1a1a2e; font-weight: 700; font-size: 15px;">${priceData.usdToInr ? `₹${priceData.usdToInr.toFixed(2)}` : "N/A"}</td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- Getting Started CTA -->
              <tr>
                <td style="padding: 28px 28px 0 28px;">
                  <div style="background: linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%); padding: 28px; border-radius: 12px; text-align: center;">
                    <p style="margin: 0 0 6px 0; color: #d4af37; font-size: 18px; font-weight: 700;">Ready to Explore?</p>
                    <p style="margin: 0 0 18px 0; color: #8892b0; font-size: 13px;">Track live prices, set alerts, compare metals and more</p>
                    <a href="https://auric--ledger.vercel.app/market" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #d4af37, #f0d060); color: #1a1a2e; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">
                      Open Market Dashboard &#8594;
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 28px 28px 20px 28px; text-align: center;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e8e4db;">
                    <tr>
                      <td style="text-align: center; padding-top: 20px;">
                        <p style="margin: 0 0 6px 0; color: #999; font-size: 11px;">
                          You're receiving this because you signed up on Auric Ledger.
                        </p>
                        <p style="margin: 0; color: #bbb; font-size: 10px;">
                          &copy; ${dayjs().format("YYYY")} Auric Ledger &bull; <span style="color: #d4af37;">Your trusted source for precious metals pricing</span>
                        </p>
                      </td>
                    </tr>
                  </table>
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
    subject: `Welcome to Auric Ledger, ${displayName}`,
    html: emailContent
  });
};

// Endpoint to trigger manual price alert (user-set alerts)
app.post("/trigger-price-alert", async (req, res) => {
  try {
    const { email, metalName, currentPrice, alertType, alertDirection, targetValue, browserNotificationEnabled } = req.body;
    
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
        const isThreshold = alertType === "price_threshold" || alertType === "target_price";
        const direction = alertDirection || "below";
        
        const message = isThreshold
          ? `${metalName} has crossed ${direction} your threshold of ₹${targetValue}/g! Current price: ₹${currentPrice.toFixed(2)}/g`
          : `${metalName} has changed by ${targetValue}%! Current price: ₹${currentPrice.toFixed(2)}/g`;

        const alertTitle = isThreshold
          ? (direction === "below" ? "Price Dropped Below Threshold" : "Price Crossed Above Threshold")
          : "Percentage Change Alert Triggered";

        const alertIcon = isThreshold
          ? (direction === "below" ? "📉" : "📈")
          : "⚡";

        const alertColor = isThreshold
          ? (direction === "below" ? "#dc2626" : "#16a34a")
          : "#d4af37";

        const alertBgLight = isThreshold
          ? (direction === "below" ? "#fef2f2" : "#f0fdf4")
          : "#fffbeb";

        const alertBorderColor = isThreshold
          ? (direction === "below" ? "#fca5a5" : "#86efac")
          : "#fde68a";

        // Fetch 7-day context for the alerted metal
        let weeklyContext = null;
        try {
          // Resolve metal code from display name
          const metalCodeMap = { 'Gold': 'XAU', 'Silver': 'XAG', 'Platinum': 'XPT', 'Palladium': 'XPD', 'Copper': 'XCU', 'Lead': 'LEAD', 'Nickel': 'NI', 'Zinc': 'ZNC', 'Aluminium': 'ALU' };
          const metalCode = metalCodeMap[metalName] || metalName;
          const isGoldMetal = metalCode === "XAU";
          const carat = isGoldMetal ? "22" : null;
          const history = await getWeeklyHistory({ metal: metalCode, carat });
          if (history && history.length > 1) {
            const prices = history.map(h => h.price_1g).filter(Boolean);
            weeklyContext = {
              high: Math.max(...prices),
              low: Math.min(...prices),
              open: prices[0],
              days: prices.length
            };
          }
        } catch (e) { /* silently skip weekly context */ }

        // Build 7-day range bar visual
        let rangeBarHtml = "";
        if (weeklyContext) {
          const range = weeklyContext.high - weeklyContext.low;
          const position = range > 0 ? Math.min(100, Math.max(0, ((currentPrice - weeklyContext.low) / range) * 100)) : 50;
          rangeBarHtml = `
            <!-- 7-Day Price Range -->
            <tr>
              <td style="padding: 0 28px 24px 28px;">
                <div style="background-color: #f8f6f0; padding: 20px; border-radius: 10px; border: 1px solid #e8e4db;">
                  <p style="margin: 0 0 12px 0; color: #1a1a2e; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">📊 7-Day Price Range (${weeklyContext.days} days)</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color: #dc2626; font-size: 12px; font-weight: 600; width: 80px;">₹${weeklyContext.low.toFixed(2)}</td>
                      <td style="padding: 0 8px;">
                        <div style="background-color: #e5e7eb; border-radius: 10px; height: 12px; position: relative; overflow: visible;">
                          <div style="background: linear-gradient(90deg, #dc2626, #d4af37, #16a34a); border-radius: 10px; height: 12px; width: 100%;"></div>
                          <div style="position: absolute; top: -4px; left: ${position}%; width: 4px; height: 20px; background-color: #1a1a2e; border-radius: 2px; transform: translateX(-50%);"></div>
                        </div>
                        <p style="margin: 4px 0 0 0; text-align: center; color: #666; font-size: 10px;">Current: ₹${currentPrice.toFixed(2)}</p>
                      </td>
                      <td style="color: #16a34a; font-size: 12px; font-weight: 600; text-align: right; width: 80px;">₹${weeklyContext.high.toFixed(2)}</td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
                    <tr>
                      <td width="50%" style="padding-right: 8px;">
                        <div style="background-color: #ffffff; padding: 10px; border-radius: 6px; text-align: center;">
                          <p style="margin: 0; color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Week Open</p>
                          <p style="margin: 2px 0 0 0; color: #2c3e50; font-size: 14px; font-weight: 700;">₹${weeklyContext.open.toFixed(2)}</p>
                        </div>
                      </td>
                      <td width="50%" style="padding-left: 8px;">
                        <div style="background-color: #ffffff; padding: 10px; border-radius: 6px; text-align: center;">
                          <p style="margin: 0; color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Week Range</p>
                          <p style="margin: 2px 0 0 0; color: #2c3e50; font-size: 14px; font-weight: 700;">₹${(weeklyContext.high - weeklyContext.low).toFixed(2)}</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>`;
        }

        const emailContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #eae6dd;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eae6dd; padding: 20px 10px;">
              <tr>
                <td align="center">
                  <table width="640" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); overflow: hidden;">
                    
                    <!-- Urgent Alert Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 32px 28px 24px 28px; text-align: center;">
                        <img src="https://auric--ledger.vercel.app/metal-price-icon.svg" alt="AL" width="44" height="44" style="display: block; margin: 0 auto 12px auto; border-radius: 50%;" />
                        <div style="display: inline-block; padding: 6px 20px; background-color: ${alertColor}22; border: 1px solid ${alertColor}; border-radius: 50px; margin-bottom: 14px;">
                          <span style="color: ${alertColor}; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">${alertIcon} Price Alert</span>
                        </div>
                        <h1 style="margin: 0; color: #d4af37; font-size: 32px; font-weight: 700; letter-spacing: 1px;">Auric Ledger</h1>
                        <p style="margin: 6px 0 0 0; color: #8892b0; font-size: 12px; letter-spacing: 1px;">${dayjs().format("dddd, DD MMMM YYYY")} &bull; ${dayjs().format("HH:mm")} IST</p>
                      </td>
                    </tr>

                    <!-- Alert Banner -->
                    <tr>
                      <td style="padding: 28px 28px 0 28px;">
                        <div style="background-color: ${alertBgLight}; padding: 20px; border-radius: 10px; border: 1px solid ${alertBorderColor}; border-left: 5px solid ${alertColor};">
                          <p style="margin: 0 0 4px 0; color: ${alertColor}; font-size: 16px; font-weight: 700;">${alertTitle}</p>
                          <p style="margin: 0; color: #555; font-size: 14px; line-height: 1.5;">${message}</p>
                        </div>
                      </td>
                    </tr>

                    <!-- Price Spotlight Card -->
                    <tr>
                      <td style="padding: 24px 28px 0 28px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; overflow: hidden;">
                          <tr>
                            <td style="padding: 24px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="vertical-align: middle;">
                                    <p style="margin: 0; color: #8892b0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">${metalName}</p>
                                    <p style="margin: 6px 0 0 0; color: #d4af37; font-size: 32px; font-weight: 700;">₹${currentPrice.toFixed(2)}<span style="font-size: 14px; color: #8892b0; font-weight: 400;">/gram</span></p>
                                  </td>
                                  <td style="text-align: right; vertical-align: middle;">
                                    <div style="display: inline-block; background-color: ${alertColor}22; padding: 10px 16px; border-radius: 10px;">
                                      <p style="margin: 0; color: #8892b0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">${isThreshold ? "Your Target" : "Change Threshold"}</p>
                                      <p style="margin: 4px 0 0 0; color: #f0f0f0; font-size: 20px; font-weight: 700;">${isThreshold ? `₹${targetValue}` : `${targetValue}%`}</p>
                                    </div>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Alert Details Grid -->
                    <tr>
                      <td style="padding: 24px 28px 0 28px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="32%" style="padding-right: 8px;">
                              <div style="background-color: #f8f6f0; padding: 16px; border-radius: 10px; text-align: center; border: 1px solid #e8e4db;">
                                <p style="margin: 0; color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Alert Type</p>
                                <p style="margin: 6px 0 0 0; color: #2c3e50; font-size: 13px; font-weight: 700;">${isThreshold ? "Price Threshold" : "% Change"}</p>
                              </div>
                            </td>
                            <td width="36%" style="padding: 0 4px;">
                              <div style="background-color: #f8f6f0; padding: 16px; border-radius: 10px; text-align: center; border: 1px solid #e8e4db;">
                                <p style="margin: 0; color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">${isThreshold ? "Direction" : "Movement"}</p>
                                <p style="margin: 6px 0 0 0; color: ${alertColor}; font-size: 13px; font-weight: 700;">${isThreshold ? (direction === "below" ? "▼ Dropped Below" : "▲ Crossed Above") : `${alertIcon} Threshold Hit`}</p>
                              </div>
                            </td>
                            <td width="32%" style="padding-left: 8px;">
                              <div style="background-color: #f8f6f0; padding: 16px; border-radius: 10px; text-align: center; border: 1px solid #e8e4db;">
                                <p style="margin: 0; color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Triggered At</p>
                                <p style="margin: 6px 0 0 0; color: #2c3e50; font-size: 13px; font-weight: 700;">${dayjs().format("HH:mm:ss")}</p>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    ${rangeBarHtml}

                    <!-- Action Recommendations -->
                    <tr>
                      <td style="padding: ${weeklyContext ? "0" : "24px"} 28px 24px 28px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="48%" style="padding-right: 8px; vertical-align: top;">
                              <div style="background-color: #f0fdf4; padding: 16px; border-radius: 10px; border: 1px solid #bbf7d0; height: 100%;">
                                <p style="margin: 0 0 6px 0; color: #166534; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">✅ Recommended</p>
                                <p style="margin: 0; color: #15803d; font-size: 12px; line-height: 1.5;">
                                  Review the current market trend on the app before making any trade decisions.
                                </p>
                              </div>
                            </td>
                            <td width="4%"></td>
                            <td width="48%" style="padding-left: 8px; vertical-align: top;">
                              <div style="background-color: #eff6ff; padding: 16px; border-radius: 10px; border: 1px solid #bfdbfe; height: 100%;">
                                <p style="margin: 0 0 6px 0; color: #1e40af; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">🔔 Manage Alerts</p>
                                <p style="margin: 0; color: #1d4ed8; font-size: 12px; line-height: 1.5;">
                                  You can modify or delete this alert anytime from the Market page settings.
                                </p>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 0 28px 20px 28px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 12px; overflow: hidden;">
                          <tr>
                            <td style="padding: 24px; text-align: center;">
                              <p style="margin: 0 0 14px 0; color: #8892b0; font-size: 13px;">
                                View charts, compare metals &amp; update your alerts
                              </p>
                              <a href="https://auric--ledger.vercel.app/market" style="display: inline-block; padding: 13px 32px; background: linear-gradient(135deg, #d4af37, #f0d060); color: #1a1a2e; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">
                                Open Market Dashboard →
                              </a>
                              <p style="margin: 16px 0 0 0; color: #4a5568; font-size: 10px;">
                                © ${dayjs().format("YYYY")} Auric Ledger &bull; <span style="color: #d4af37;">Your trusted source for precious metals pricing</span>
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Spacer -->
                    <tr><td style="height: 12px;"></td></tr>

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
          subject: `${metalName} Price Alert \u2014 ₹${currentPrice.toFixed(2)}/g | Auric Ledger`,
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

    // Available metals (matching frontend)
    const availableMetals = ['XAU', 'XAG', 'XPT', 'XPD', 'XCU', 'LEAD', 'NI', 'ZNC', 'ALU'];
    const preciousMetals = ['XAU', 'XAG', 'XPT', 'XPD'];
    const industrialMetals = ['XCU', 'LEAD', 'NI', 'ZNC', 'ALU'];

    const metalNames = {
      'XAU': 'Gold', 'XAG': 'Silver', 'XPT': 'Platinum', 'XPD': 'Palladium',
      'XCU': 'Copper', 'LEAD': 'Lead', 'NI': 'Nickel', 'ZNC': 'Zinc', 'ALU': 'Aluminium'
    };

    // Collect today's prices (22K for gold)
    const metalPrices = {};
    const goldCaratPrices = {};

    priceData.rows.forEach(row => {
      if (!availableMetals.includes(row.metal_name)) return;
      if (row.metal_name === "XAU") {
        if (row.carat && row.price_1g) {
          goldCaratPrices[row.carat] = { price_1g: row.price_1g, price_8g: row.price_8g };
        }
        if (row.carat === "22" && row.price_1g) {
          metalPrices['XAU'] = row.price_1g;
        }
        return;
      }
      if (!metalPrices[row.metal_name] && row.price_1g) {
        metalPrices[row.metal_name] = row.price_1g;
      }
    });

    // Fetch yesterday's prices for day-over-day comparison
    const comparisons = {};
    try {
      const comparisonPromises = availableMetals.map(async (metal) => {
        const carat = metal === "XAU" ? "22" : null;
        const comp = await getComparison({ metal, carat });
        if (comp) comparisons[metal] = comp;
      });
      await Promise.all(comparisonPromises);
    } catch (compErr) {
      console.warn("⚠️ Could not fetch comparisons for daily email:", compErr.message);
    }

    // Fetch 7-day history for Gold (22K) and Silver for weekly stats
    const weeklyStats = {};
    try {
      const weeklyPromises = [
        { metal: "XAU", carat: "22" },
        { metal: "XAG", carat: null }
      ].map(async ({ metal, carat }) => {
        const history = await getWeeklyHistory({ metal, carat });
        if (history && history.length > 0) {
          const prices = history.map(h => h.price_1g).filter(Boolean);
          weeklyStats[metal] = {
            high: Math.max(...prices),
            low: Math.min(...prices),
            open: prices[0],
            close: prices[prices.length - 1],
            days: prices.length
          };
        }
      });
      await Promise.all(weeklyPromises);
    } catch (weekErr) {
      console.warn("⚠️ Could not fetch weekly stats for daily email:", weekErr.message);
    }

    // Helper: format change badge
    const changeBadge = (metal) => {
      const comp = comparisons[metal];
      if (!comp) return { changeStr: "—", changeColor: "#888", arrow: "", pctStr: "" };
      const todayP = comp.today_prices.price_1g;
      const yesterdayP = comp.yesterday_prices.price_1g;
      if (!todayP || !yesterdayP || todayP === yesterdayP) return { changeStr: "₹0.00", changeColor: "#888", arrow: "→", pctStr: "0.00%" };
      const diff = todayP - yesterdayP;
      const pct = ((diff / yesterdayP) * 100);
      const isUp = diff > 0;
      return {
        changeStr: `${isUp ? "+" : ""}₹${diff.toFixed(2)}`,
        changeColor: isUp ? "#16a34a" : "#dc2626",
        arrow: isUp ? "▲" : "▼",
        pctStr: `${isUp ? "+" : ""}${pct.toFixed(2)}%`
      };
    };

    // Count gainers vs losers for market sentiment
    let gainers = 0, losers = 0, unchanged = 0;
    availableMetals.forEach(m => {
      const comp = comparisons[m];
      if (!comp) { unchanged++; return; }
      const diff = comp.today_prices.price_1g - comp.yesterday_prices.price_1g;
      if (diff > 0) gainers++;
      else if (diff < 0) losers++;
      else unchanged++;
    });
    const sentimentLabel = gainers > losers ? "Bullish" : (losers > gainers ? "Bearish" : "Mixed");
    const sentimentColor = gainers > losers ? "#16a34a" : (losers > gainers ? "#dc2626" : "#d4af37");
    const sentimentIcon = gainers > losers ? "📈" : (losers > gainers ? "📉" : "➡️");

    // Build precious metals rows
    const buildMetalRow = (metal, isAlt) => {
      const price = metalPrices[metal];
      const { changeStr, changeColor, arrow, pctStr } = changeBadge(metal);
      const bgColor = isAlt ? "#f8f6f0" : "#ffffff";
      return `
        <tr style="background-color: ${bgColor};">
          <td style="padding: 14px 16px; border-bottom: 1px solid #e8e4db; font-weight: 600; color: #2c3e50; font-size: 14px;">${metalNames[metal]}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e8e4db; text-align: right; font-weight: 700; color: #2c3e50; font-size: 15px;">${price ? `₹${price.toFixed(2)}` : "N/A"}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e8e4db; text-align: right; font-size: 13px; color: ${changeColor}; font-weight: 600;">
            <span style="font-size: 11px;">${arrow}</span> ${changeStr}
          </td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e8e4db; text-align: right; font-size: 13px; color: ${changeColor}; font-weight: 600;">${pctStr || "—"}</td>
        </tr>`;
    };

    // Build gold carat section
    let goldCaratRows = "";
    const caratOrder = ["24", "22", "18"];
    caratOrder.forEach((c, i) => {
      const cp = goldCaratPrices[c];
      if (!cp) return;
      const bgColor = i % 2 === 0 ? "#fffdf5" : "#ffffff";
      goldCaratRows += `
        <tr style="background-color: ${bgColor};">
          <td style="padding: 10px 16px; border-bottom: 1px solid #f0ecdf; color: #5a5a5a; font-size: 14px;">${c}K Gold</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #f0ecdf; text-align: right; font-weight: 700; color: #2c3e50; font-size: 14px;">₹${cp.price_1g.toFixed(2)}</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #f0ecdf; text-align: right; color: #666; font-size: 13px;">${cp.price_8g ? `₹${cp.price_8g.toFixed(2)}` : "—"}</td>
        </tr>`;
    });

    // Build weekly stats section for Gold & Silver
    let weeklySection = "";
    ["XAU", "XAG"].forEach(metal => {
      const ws = weeklyStats[metal];
      if (!ws) return;
      const weekChange = ws.close - ws.open;
      const weekPct = ((weekChange / ws.open) * 100);
      const isUp = weekChange > 0;
      const trendColor = isUp ? "#16a34a" : "#dc2626";
      weeklySection += `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e8e4db; font-weight: 600; color: #2c3e50; font-size: 14px;">${metalNames[metal]}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e8e4db; text-align: center; color: #16a34a; font-weight: 600; font-size: 13px;">₹${ws.high.toFixed(2)}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e8e4db; text-align: center; color: #dc2626; font-weight: 600; font-size: 13px;">₹${ws.low.toFixed(2)}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e8e4db; text-align: center; color: #666; font-size: 13px;">₹${(ws.high - ws.low).toFixed(2)}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #e8e4db; text-align: right; color: ${trendColor}; font-weight: 600; font-size: 13px;">
            ${isUp ? "▲" : "▼"} ${isUp ? "+" : ""}${weekPct.toFixed(2)}%
          </td>
        </tr>`;
    });

    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #eae6dd;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eae6dd; padding: 20px 10px;">
          <tr>
            <td align="center">
              <table width="640" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12); overflow: hidden;">
                
                <!-- Premium Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 36px 30px 28px 30px; text-align: center;">
                    <img src="https://auric--ledger.vercel.app/metal-price-icon.svg" alt="AL" width="44" height="44" style="display: block; margin: 0 auto 12px auto; border-radius: 50%;" />
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <div style="display: inline-block; padding: 8px 24px; border: 2px solid #d4af37; border-radius: 50px; margin-bottom: 12px;">
                            <span style="color: #d4af37; font-size: 14px; letter-spacing: 3px; text-transform: uppercase; font-weight: 600;">Daily Market Report</span>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top: 8px;">
                          <h1 style="margin: 0; color: #d4af37; font-size: 36px; font-weight: 700; letter-spacing: 1px;">Auric Ledger</h1>
                          <p style="margin: 6px 0 0 0; color: #8892b0; font-size: 13px; letter-spacing: 1px;">${dayjs().format("dddd, DD MMMM YYYY")} &bull; 9:00 AM IST</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Market Snapshot Bar -->
                <tr>
                  <td style="background: linear-gradient(90deg, #1a1a2e 0%, #16213e 100%); padding: 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="33%" style="padding: 16px 20px; text-align: center; border-right: 1px solid #2a2a4a;">
                          <p style="margin: 0; color: #8892b0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Exchange Rate</p>
                          <p style="margin: 4px 0 0 0; color: #f0f0f0; font-size: 16px; font-weight: 700;">₹${priceData.usdToInr.toFixed(2)}</p>
                          <p style="margin: 2px 0 0 0; color: #8892b0; font-size: 10px;">USD/INR</p>
                        </td>
                        <td width="34%" style="padding: 16px 20px; text-align: center; border-right: 1px solid #2a2a4a;">
                          <p style="margin: 0; color: #8892b0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Market Mood</p>
                          <p style="margin: 4px 0 0 0; color: ${sentimentColor}; font-size: 16px; font-weight: 700;">${sentimentIcon} ${sentimentLabel}</p>
                          <p style="margin: 2px 0 0 0; color: #8892b0; font-size: 10px;">${gainers}↑ ${losers}↓ ${unchanged}→</p>
                        </td>
                        <td width="33%" style="padding: 16px 20px; text-align: center;">
                          <p style="margin: 0; color: #8892b0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Metals Tracked</p>
                          <p style="margin: 4px 0 0 0; color: #f0f0f0; font-size: 16px; font-weight: 700;">${Object.keys(metalPrices).length}</p>
                          <p style="margin: 2px 0 0 0; color: #8892b0; font-size: 10px;">Live Prices</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Gold Spotlight -->
                <tr>
                  <td style="padding: 28px 28px 0 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fffdf5 0%, #fef9e7 100%); border-radius: 10px; border: 1px solid #f0e6c8; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px 20px 8px 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <p style="margin: 0; color: #b8860b; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">🏆 Gold Spotlight</p>
                              </td>
                              <td style="text-align: right;">
                                <span style="display: inline-block; background-color: ${changeBadge('XAU').changeColor}22; color: ${changeBadge('XAU').changeColor}; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700;">${changeBadge('XAU').arrow} ${changeBadge('XAU').pctStr}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 20px 16px 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                            <tr style="border-bottom: 2px solid #e8dfc0;">
                              <th style="padding: 8px 0; text-align: left; color: #8b7d4a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Purity</th>
                              <th style="padding: 8px 0; text-align: right; color: #8b7d4a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Per Gram</th>
                              <th style="padding: 8px 0; text-align: right; color: #8b7d4a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Per 8 Grams</th>
                            </tr>
                            ${goldCaratRows}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Precious Metals Table -->
                <tr>
                  <td style="padding: 28px 28px 0 28px;">
                    <h2 style="margin: 0 0 14px 0; color: #1a1a2e; font-size: 17px; font-weight: 700; letter-spacing: 0.5px;">
                      <span style="color: #d4af37;">◆</span> Precious Metals
                    </h2>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e8e4db;">
                      <tr style="background: linear-gradient(90deg, #1a1a2e, #16213e);">
                        <th style="padding: 12px 16px; text-align: left; color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Metal</th>
                        <th style="padding: 12px 16px; text-align: right; color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Price/g</th>
                        <th style="padding: 12px 16px; text-align: right; color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Day Chg</th>
                        <th style="padding: 12px 16px; text-align: right; color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Chg %</th>
                      </tr>
                      ${preciousMetals.map((m, i) => buildMetalRow(m, i % 2 === 1)).join("")}
                    </table>
                  </td>
                </tr>

                <!-- Industrial Metals Table -->
                <tr>
                  <td style="padding: 24px 28px 0 28px;">
                    <h2 style="margin: 0 0 14px 0; color: #1a1a2e; font-size: 17px; font-weight: 700; letter-spacing: 0.5px;">
                      <span style="color: #607d8b;">◆</span> Industrial Metals
                    </h2>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e8e4db;">
                      <tr style="background: linear-gradient(90deg, #37474f, #455a64);">
                        <th style="padding: 12px 16px; text-align: left; color: #b0bec5; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Metal</th>
                        <th style="padding: 12px 16px; text-align: right; color: #b0bec5; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Price/g</th>
                        <th style="padding: 12px 16px; text-align: right; color: #b0bec5; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Day Chg</th>
                        <th style="padding: 12px 16px; text-align: right; color: #b0bec5; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Chg %</th>
                      </tr>
                      ${industrialMetals.map((m, i) => buildMetalRow(m, i % 2 === 1)).join("")}
                    </table>
                  </td>
                </tr>

                <!-- 7-Day Performance -->
                ${weeklySection ? `
                <tr>
                  <td style="padding: 28px 28px 0 28px;">
                    <h2 style="margin: 0 0 14px 0; color: #1a1a2e; font-size: 17px; font-weight: 700; letter-spacing: 0.5px;">
                      <span style="color: #d4af37;">◆</span> 7-Day Performance
                    </h2>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e8e4db;">
                      <tr style="background: linear-gradient(90deg, #1a1a2e, #16213e);">
                        <th style="padding: 12px 16px; text-align: left; color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Metal</th>
                        <th style="padding: 12px 16px; text-align: center; color: #16a34a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">7D High</th>
                        <th style="padding: 12px 16px; text-align: center; color: #dc2626; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">7D Low</th>
                        <th style="padding: 12px 16px; text-align: center; color: #8892b0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Range</th>
                        <th style="padding: 12px 16px; text-align: right; color: #d4af37; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">7D Chg</th>
                      </tr>
                      ${weeklySection}
                    </table>
                  </td>
                </tr>
                ` : ""}

                <!-- Disclaimer & Insights -->
                <tr>
                  <td style="padding: 28px 28px 0 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="48%" style="vertical-align: top;">
                          <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; border: 1px solid #bbf7d0;">
                            <p style="margin: 0 0 6px 0; color: #166534; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">💡 Quick Tip</p>
                            <p style="margin: 0; color: #15803d; font-size: 12px; line-height: 1.5;">
                              Set custom price alerts in the app to get notified instantly when metals hit your target price.
                            </p>
                          </div>
                        </td>
                        <td width="4%"></td>
                        <td width="48%" style="vertical-align: top;">
                          <div style="background-color: #fffbeb; padding: 16px; border-radius: 8px; border: 1px solid #fde68a;">
                            <p style="margin: 0 0 6px 0; color: #92400e; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">📊 Disclaimer</p>
                            <p style="margin: 0; color: #a16207; font-size: 12px; line-height: 1.5;">
                              Prices include import duty &amp; GST. For investment decisions, consult your financial advisor.
                            </p>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 28px 28px 0 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 12px; overflow: hidden;">
                      <tr>
                        <td style="padding: 28px; text-align: center;">
                          <p style="margin: 0 0 16px 0; color: #8892b0; font-size: 14px;">
                            View interactive charts, compare metals &amp; manage alerts
                          </p>
                          <a href="https://auric--ledger.vercel.app/market" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #d4af37, #f0d060); color: #1a1a2e; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">
                            Open Market Dashboard →
                          </a>
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px; border-top: 1px solid #2a2a4a; padding-top: 16px;">
                            <tr>
                              <td style="text-align: center; padding-top: 16px;">
                                <p style="margin: 0; color: #4a5568; font-size: 11px;">
                                  © ${dayjs().format("YYYY")} Auric Ledger &bull; Prices updated daily at 9:00 AM IST
                                </p>
                                <p style="margin: 6px 0 0 0; color: #d4af37; font-size: 11px; font-weight: 600;">
                                  Your trusted source for precious metals pricing
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Spacer -->
                <tr><td style="height: 20px;"></td></tr>

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
        await emailTransporter.sendMail({
          from: EMAIL_FROM,
          to: subscription.email,
          subject: `Daily Metals Report \u2014 ${dayjs().format("DD MMM YYYY")} | Auric Ledger`,
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
        
        // Try to look up username from Supabase auth
        let username = null;
        try {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const authUser = users.find(u => u.email === subscription.email);
          if (authUser) {
            const meta = authUser.user_metadata || {};
            username = meta.display_name || meta.full_name || meta.name || null;
          }
        } catch (authErr) {
          // Silently skip - user may not have an account (email-only subscriber)
        }
        
        // Send welcome email
        await sendWelcomeEmail(subscription.email, { rows, usdToInr, date: latestDate }, username);
        
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

// Track whether a summary is currently being generated
let summaryGenerating = false;

// SSE clients for real-time summary notifications
const summarySSEClients = new Set();

const broadcastSummaryEvent = (event, data) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of summarySSEClients) {
    try { client.write(payload); } catch { summarySSEClients.delete(client); }
  }
};

// SSE endpoint — frontend connects here for real-time summary status
app.get("/summary-events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(`event: connected\ndata: {"generating":${summaryGenerating}}\n\n`);
  summarySSEClients.add(res);
  req.on("close", () => summarySSEClients.delete(res));
});

// POST /generate-daily-summary — Called by cron-job.org at 9:01 AM IST
// Background worker for summary generation (runs after immediate response)
const generateSummaryInBackground = async (today) => {
  summaryGenerating = true;
  try {
    // ── Step 1: Fetch today's prices ──
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

    // ── Step 2: Fetch yesterday's prices ──
    const yesterday = dayjs(today).subtract(1, "day").format("YYYY-MM-DD");
    const { data: yesterdayPrices } = await supabase
      .from("metal_prices")
      .select("metal_name, price_1g, price_8g, price_per_kg, carat, date")
      .eq("date", yesterday);

    // ── Step 3: Index prices into lookup maps ──
    const metalOrder = [
      { sym: "XAU", name: "Gold", carats: ["22", "24", "18"] },
      { sym: "XAG", name: "Silver" },
      { sym: "XPT", name: "Platinum" },
      { sym: "XPD", name: "Palladium" },
      { sym: "XCU", name: "Copper" },
      { sym: "LEAD", name: "Lead" },
      { sym: "NI", name: "Nickel" },
      { sym: "ZNC", name: "Zinc" },
      { sym: "ALU", name: "Aluminium" },
    ];

    const indexPrices = (rows) => {
      const map = {};
      if (!rows) return map;
      rows.forEach(row => {
        if (row.metal_name === "XAU" && row.carat) {
          map[`XAU_${row.carat}K`] = { price_1g: row.price_1g, price_8g: row.price_8g };
        } else if (row.price_1g) {
          map[row.metal_name] = { price_1g: row.price_1g, price_per_kg: row.price_per_kg };
        }
      });
      return map;
    };

    const todayMap = indexPrices(todayPrices);
    const yestMap = indexPrices(yesterdayPrices);

    // ── Step 4: Pre-compute all changes in code (no LLM math) ──
    const fmt = (n) => n != null ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "N/A";
    const lines = [];

    lines.push(`Date: ${today} (Yesterday: ${yesterday})`);
    lines.push("");

    for (const metal of metalOrder) {
      if (metal.sym === "XAU") {
        for (const c of metal.carats) {
          const key = `XAU_${c}K`;
          const t = todayMap[key];
          const y = yestMap[key];
          if (!t) continue;
          const todayG = t.price_1g;
          const yestG = y?.price_1g;
          const change = yestG != null ? (todayG - yestG) : null;
          const pct = (yestG != null && yestG !== 0) ? ((change / yestG) * 100) : null;
          const arrow = change != null ? (change > 0 ? "↑" : change < 0 ? "↓" : "→") : "—";
          const changeTxt = change != null ? `${change >= 0 ? "+" : ""}${fmt(change)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)` : "no yesterday data";
          lines.push(`Gold ${c}K: ${fmt(todayG)}/g | Yesterday: ${yestG != null ? fmt(yestG) + "/g" : "N/A"} | Change: ${arrow} ${changeTxt}`);
        }
      } else {
        const t = todayMap[metal.sym];
        const y = yestMap[metal.sym];
        if (!t) continue;
        const todayG = t.price_1g;
        const yestG = y?.price_1g;
        const change = yestG != null ? (todayG - yestG) : null;
        const pct = (yestG != null && yestG !== 0) ? ((change / yestG) * 100) : null;
        const arrow = change != null ? (change > 0 ? "↑" : change < 0 ? "↓" : "→") : "—";
        const changeTxt = change != null ? `${change >= 0 ? "+" : ""}${fmt(change)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)` : "no yesterday data";
        const kgTxt = t.price_per_kg ? ` | ${fmt(t.price_per_kg)}/kg` : "";
        lines.push(`${metal.name}: ${fmt(todayG)}/g${kgTxt} | Yesterday: ${yestG != null ? fmt(yestG) + "/g" : "N/A"} | Change: ${arrow} ${changeTxt}`);
      }
    }

    const preComputedData = lines.join("\n");

    // ── Step 5: Build detailed prompt for Gemini ──
    const summaryPrompt = `Here is today's metal price data with all changes already calculated:

${preComputedData}

Write a comprehensive daily market summary for **Auric Ledger** using ONLY the exact numbers above. Do NOT recalculate, round, or invent any numbers.

**Structure (use markdown headings and bold):**

1. **Market Overview** (3-4 sentences)
   - Lead with Gold 22K as the headline price (this is the standard jewellery benchmark in India)
   - Summarize the overall market mood — are precious metals rising or falling? Any notable moves?
   - Mention if base metals are trending differently from precious metals

2. **Precious Metals** (detailed paragraph)
   - Gold: Lead with 22K price and change, then mention 24K and 18K prices and their changes
   - Explain briefly why 22K matters (most traded purity for Indian jewellery)
   - Silver: price, change, and brief context (industrial + investment demand)
   - Platinum & Palladium: prices and changes

3. **Base Metals** (detailed paragraph)
   - Cover Copper, Lead, Nickel, Zinc, Aluminium with prices and changes
   - Note any significant movers (biggest % gain or loss)
   - Mention per-kg prices where available for industrial context

4. **Key Takeaways** (2-3 bullet points)
   - What should investors or jewellers watch today?
   - Any divergences between precious and industrial metals?
   - Brief forward-looking observation based on the price trends

**Rules:**
- Use the EXACT ₹ amounts and % from the data — never compute your own
- Use ₹ symbol only, never $ or USD
- Use ↑ ↓ → arrows for direction
- Write in a professional, authoritative financial tone
- Use **bold** for metal names and section headers
- Keep paragraphs readable — no walls of text
- Do NOT add external information, news, or predictions not supported by the data`;

    // ── Step 6: Call Groq + HF Space in parallel, prefer Groq response ──
    const systemMessage = "You are the senior market analyst at Auric Ledger, India's premium precious metals intelligence platform. You write authoritative, detailed daily market summaries for Indian investors, jewellers, and metal traders. Your tone is professional yet accessible — like a Bloomberg brief tailored for the Indian metals market. You ONLY use pre-computed price data provided to you. You never fabricate numbers, never use USD, and always reference Gold 22K as the primary benchmark since it is the standard jewellery purity in India. All prices are in Indian Rupees (₹). You use markdown formatting (bold, headers) for readability.";

    const chatMessages = [
      { role: "system", content: systemMessage },
      { role: "user", content: summaryPrompt },
    ];

    // Fire both requests simultaneously
    console.log("📡 Sending summary prompt to Groq + HF Space in parallel...");

    const groqPromise = GROQ_API_KEY
      ? axios.post(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            model: "llama-3.3-70b-versatile",
            messages: chatMessages,
            temperature: 0.35,
            max_tokens: 2048,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            timeout: 60000,
          }
        ).then((res) => {
          const text = res.data?.choices?.[0]?.message?.content;
          console.log(text ? "✅ Groq response received" : "⚠️ Groq returned empty");
          return text || null;
        }).catch((err) => {
          console.warn("⚠️ Groq failed:", err.response?.status || err.message);
          return null;
        })
      : Promise.resolve(null);

    const hfPromise = axios.post(
      "https://valtry-auric-bot.hf.space/v1/chat/completions",
      {
        model: "auric-ai",
        messages: chatMessages,
        temperature: 0.35,
        max_tokens: 2048,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 120000,
      }
    ).then((res) => {
      const text = res.data?.choices?.[0]?.message?.content;
      console.log(text ? "✅ HF Space response received" : "⚠️ HF Space returned empty");
      return text || null;
    }).catch((err) => {
      console.warn("⚠️ HF Space failed:", err.response?.status || err.message);
      return null;
    });

    const [groqSummary, hfSummary] = await Promise.all([groqPromise, hfPromise]);

    // Prefer Groq, fall back to HF
    const summary = groqSummary || hfSummary;
    if (groqSummary) {
      console.log("📝 Using Groq summary");
    } else if (hfSummary) {
      console.log("📝 Using HF Space summary (Groq unavailable)");
    }

    if (!summary) {
      console.error("❌ Both Groq and HF Space failed. No summary generated.");
      return;
    }

    // ── Step 7: Save to database ──
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
    // Notify all connected frontends with the new summary
    broadcastSummaryEvent("complete", { generating: false, date: today, summary });
  } catch (error) {
    console.error("❌ Background summary generation error:", error.message);
    broadcastSummaryEvent("error", { generating: false });
  } finally {
    summaryGenerating = false;
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

    // Notify all connected frontends to show loader immediately
    broadcastSummaryEvent("generating", { generating: true, date: today });

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
      return res.json({ status: "success", date: null, summary: null, generating: summaryGenerating });
    }

    res.json({ status: "success", date: data[0].date, summary: data[0].summary, created_at: data[0].created_at, generating: summaryGenerating });
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
// PORTFOLIO SIMULATOR API
// ============================================
const portfolioLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many portfolio requests, please slow down",
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: get or create user balance
const getOrCreateBalance = async (userId) => {
  const { data: existing } = await supabase
    .from("portfolio_balances")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("portfolio_balances")
    .insert({ user_id: userId, balance: 1000000.00, initial_balance: 1000000.00 })
    .select()
    .single();

  if (error) throw error;
  return created;
};

// GET /api/portfolio?userId=xxx — Get portfolio (balance + holdings)
app.get("/api/portfolio", portfolioLimiter, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ status: "error", message: "userId is required" });

    const balanceRow = await getOrCreateBalance(userId);

    const { data: holdings, error: hErr } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("user_id", userId)
      .eq("is_sold", false)
      .order("bought_at", { ascending: false });

    if (hErr) throw hErr;

    const { data: history, error: histErr } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("user_id", userId)
      .eq("is_sold", true)
      .order("sold_at", { ascending: false })
      .limit(50);

    if (histErr) throw histErr;

    res.json({
      status: "success",
      balance: parseFloat(balanceRow.balance),
      initialBalance: parseFloat(balanceRow.initial_balance),
      holdings: (holdings || []).map(h => ({
        ...h,
        weight_grams: parseFloat(h.weight_grams),
        buy_price_per_gram: parseFloat(h.buy_price_per_gram),
        total_cost: parseFloat(h.total_cost),
        sell_price_per_gram: h.sell_price_per_gram ? parseFloat(h.sell_price_per_gram) : null,
        sell_total: h.sell_total ? parseFloat(h.sell_total) : null,
      })),
      history: (history || []).map(h => ({
        ...h,
        weight_grams: parseFloat(h.weight_grams),
        buy_price_per_gram: parseFloat(h.buy_price_per_gram),
        total_cost: parseFloat(h.total_cost),
        sell_price_per_gram: h.sell_price_per_gram ? parseFloat(h.sell_price_per_gram) : null,
        sell_total: h.sell_total ? parseFloat(h.sell_total) : null,
      })),
    });
  } catch (error) {
    console.error("Portfolio fetch error:", error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /api/portfolio/buy — Buy metal
app.post("/api/portfolio/buy", portfolioLimiter, async (req, res) => {
  try {
    const { userId, metalName, carat, weightGrams } = req.body;
    if (!userId || !metalName || !weightGrams || weightGrams <= 0) {
      return res.status(400).json({ status: "error", message: "userId, metalName, and weightGrams (>0) are required" });
    }

    // Fetch current price
    const resolvedCarat = isGold(metalName) ? (carat || "22") : null;
    const latest = await getLatestForMetal({ metal: metalName, carat: resolvedCarat });
    if (!latest || !latest.price_1g) {
      return res.status(404).json({ status: "error", message: "Current price not available for this metal" });
    }

    const pricePerGram = latest.price_1g;
    const totalCost = parseFloat((pricePerGram * weightGrams).toFixed(2));

    // Check balance
    const balanceRow = await getOrCreateBalance(userId);
    const currentBalance = parseFloat(balanceRow.balance);

    if (totalCost > currentBalance) {
      return res.status(400).json({ status: "error", message: `Insufficient balance. Need ₹${totalCost.toLocaleString("en-IN")} but have ₹${currentBalance.toLocaleString("en-IN")}` });
    }

    // Deduct balance
    const newBalance = parseFloat((currentBalance - totalCost).toFixed(2));
    const { error: balErr } = await supabase
      .from("portfolio_balances")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (balErr) throw balErr;

    // Insert holding
    const { data: holding, error: hErr } = await supabase
      .from("portfolio_holdings")
      .insert({
        user_id: userId,
        metal_name: metalName,
        carat: resolvedCarat,
        weight_grams: weightGrams,
        buy_price_per_gram: pricePerGram,
        total_cost: totalCost,
      })
      .select()
      .single();

    if (hErr) throw hErr;

    res.json({
      status: "success",
      message: `Bought ${weightGrams}g of ${metalName}${resolvedCarat ? ` (${resolvedCarat}K)` : ""} at ₹${pricePerGram.toFixed(2)}/g`,
      holding: {
        ...holding,
        weight_grams: parseFloat(holding.weight_grams),
        buy_price_per_gram: parseFloat(holding.buy_price_per_gram),
        total_cost: parseFloat(holding.total_cost),
      },
      newBalance,
    });
  } catch (error) {
    console.error("Portfolio buy error:", error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /api/portfolio/sell — Sell a holding
app.post("/api/portfolio/sell", portfolioLimiter, async (req, res) => {
  try {
    const { userId, holdingId } = req.body;
    if (!userId || !holdingId) {
      return res.status(400).json({ status: "error", message: "userId and holdingId are required" });
    }

    // Fetch holding
    const { data: holding, error: hErr } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("id", holdingId)
      .eq("user_id", userId)
      .eq("is_sold", false)
      .single();

    if (hErr || !holding) {
      return res.status(404).json({ status: "error", message: "Holding not found" });
    }

    // Fetch current sell price
    const latest = await getLatestForMetal({ metal: holding.metal_name, carat: holding.carat || null });
    if (!latest || !latest.price_1g) {
      return res.status(404).json({ status: "error", message: "Current price not available" });
    }

    const sellPricePerGram = latest.price_1g;
    const sellTotal = parseFloat((sellPricePerGram * parseFloat(holding.weight_grams)).toFixed(2));

    // Update holding as sold
    const { error: updateErr } = await supabase
      .from("portfolio_holdings")
      .update({
        is_sold: true,
        sold_at: new Date().toISOString(),
        sell_price_per_gram: sellPricePerGram,
        sell_total: sellTotal,
      })
      .eq("id", holdingId);

    if (updateErr) throw updateErr;

    // Add proceeds to balance
    const balanceRow = await getOrCreateBalance(userId);
    const newBalance = parseFloat((parseFloat(balanceRow.balance) + sellTotal).toFixed(2));

    const { error: balErr } = await supabase
      .from("portfolio_balances")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (balErr) throw balErr;

    const profit = sellTotal - parseFloat(holding.total_cost);

    res.json({
      status: "success",
      message: `Sold ${parseFloat(holding.weight_grams)}g of ${holding.metal_name} at ₹${sellPricePerGram.toFixed(2)}/g — ${profit >= 0 ? "Profit" : "Loss"}: ₹${Math.abs(profit).toFixed(2)}`,
      sellTotal,
      profit: parseFloat(profit.toFixed(2)),
      newBalance,
    });
  } catch (error) {
    console.error("Portfolio sell error:", error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /api/portfolio/topup — Add ₹10,000 (max balance ₹10,00,000)
app.post("/api/portfolio/topup", portfolioLimiter, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ status: "error", message: "userId is required" });

    const balanceRow = await getOrCreateBalance(userId);
    const currentBalance = parseFloat(balanceRow.balance);
    const MAX_BALANCE = 1000000;
    const TOPUP_AMOUNT = 10000;

    if (currentBalance >= MAX_BALANCE) {
      return res.status(400).json({ status: "error", message: "Balance is already at the maximum of ₹10,00,000." });
    }

    const newBalance = Math.min(currentBalance + TOPUP_AMOUNT, MAX_BALANCE);
    const added = newBalance - currentBalance;

    await supabase
      .from("portfolio_balances")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    res.json({
      status: "success",
      message: `Added ₹${added.toLocaleString("en-IN")} to your balance.`,
      newBalance,
    });
  } catch (error) {
    console.error("Portfolio topup error:", error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /api/portfolio/reset — Reset portfolio
app.post("/api/portfolio/reset", portfolioLimiter, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ status: "error", message: "userId is required" });

    // Delete all holdings for user
    await supabase.from("portfolio_holdings").delete().eq("user_id", userId);

    // Reset balance
    await supabase
      .from("portfolio_balances")
      .update({ balance: 1000000.00, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    res.json({ status: "success", message: "Portfolio reset. Balance restored to ₹10,00,000." });
  } catch (error) {
    console.error("Portfolio reset error:", error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// GET /api/portfolio/prices — Get all current prices for portfolio valuation
app.get("/api/portfolio/prices", portfolioLimiter, async (req, res) => {
  try {
    const { latestDate, rows } = await getLatestRows({});
    if (!rows || rows.length === 0) {
      return res.json({ status: "success", prices: {}, date: null });
    }

    const prices = {};
    rows.forEach(row => {
      const key = row.carat ? `${row.metal_name}_${row.carat}K` : row.metal_name;
      prices[key] = row.price_1g;
    });

    res.json({ status: "success", prices, date: latestDate });
  } catch (error) {
    console.error("Portfolio prices error:", error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
});

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
