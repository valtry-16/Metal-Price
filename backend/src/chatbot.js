import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import dotenv from "dotenv";

dotenv.config();
dayjs.extend(customParseFormat);

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

const HF_API_URL = "https://valtry-auric-bot.hf.space/v1/chat/completions";

const METAL_NAMES = {
  XAU: "Gold",
  XAG: "Silver",
  XPT: "Platinum",
  XPD: "Palladium",
  XCU: "Copper",
  LEAD: "Lead",
  NI: "Nickel",
  ZNC: "Zinc",
  ALU: "Aluminium",
};

const ALL_METALS = Object.keys(METAL_NAMES);

// ─────────────────────────────────────────────
// Date parsing - extract dates from natural language
// ─────────────────────────────────────────────

const MONTH_MAP = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

const parseDate = (question) => {
  const q = question.toLowerCase().trim();
  const now = dayjs();

  // "today"
  if (/\btoday\b/.test(q)) return { type: "single", date: now.format("YYYY-MM-DD") };

  // "yesterday"
  if (/\byesterday\b/.test(q)) return { type: "single", date: now.subtract(1, "day").format("YYYY-MM-DD") };

  // "last week" / "past week" / "this week"
  if (/\b(last|past|this)\s+week\b/.test(q)) return { type: "range", from: now.subtract(7, "day").format("YYYY-MM-DD"), to: now.format("YYYY-MM-DD") };

  // "last month" / "past month"
  if (/\b(last|past)\s+month\b/.test(q)) return { type: "range", from: now.subtract(30, "day").format("YYYY-MM-DD"), to: now.format("YYYY-MM-DD") };

  // "last N days"
  const lastNDays = q.match(/\blast\s+(\d+)\s+days?\b/);
  if (lastNDays) return { type: "range", from: now.subtract(parseInt(lastNDays[1]), "day").format("YYYY-MM-DD"), to: now.format("YYYY-MM-DD") };

  // "from DATE to DATE" or "between DATE and DATE"
  const rangeMatch = q.match(/(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+?)(?:\s|$)/);
  if (rangeMatch) {
    const d1 = tryParseFlexible(rangeMatch[1]);
    const d2 = tryParseFlexible(rangeMatch[2]);
    if (d1 && d2) return { type: "range", from: d1, to: d2 };
  }

  // "on 22 february" / "on february 22" / "on 22 feb 2026" / "22nd february"
  const onDate = q.match(/(?:on|for|of|price\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/);
  if (onDate) {
    const day = onDate[1].padStart(2, "0");
    const month = MONTH_MAP[onDate[2]];
    const year = onDate[3] || now.format("YYYY");
    return { type: "single", date: `${year}-${month}-${day}` };
  }

  // "february 22" / "feb 22, 2026"
  const monthFirst = q.match(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s*(\d{4})?/);
  if (monthFirst) {
    const day = monthFirst[2].padStart(2, "0");
    const month = MONTH_MAP[monthFirst[1]];
    const year = monthFirst[3] || now.format("YYYY");
    return { type: "single", date: `${year}-${month}-${day}` };
  }

  // "2026-02-22" or "22/02/2026" or "22-02-2026"
  const isoDate = q.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoDate) return { type: "single", date: `${isoDate[1]}-${isoDate[2].padStart(2, "0")}-${isoDate[3].padStart(2, "0")}` };

  const dmyDate = q.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyDate) return { type: "single", date: `${dmyDate[3]}-${dmyDate[2].padStart(2, "0")}-${dmyDate[1].padStart(2, "0")}` };

  // "in january" / "in feb 2026" -> whole month
  const inMonth = q.match(/\bin\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/);
  if (inMonth) {
    const month = MONTH_MAP[inMonth[1]];
    const year = inMonth[2] || now.format("YYYY");
    const from = `${year}-${month}-01`;
    const to = dayjs(from).endOf("month").format("YYYY-MM-DD");
    return { type: "range", from, to };
  }

  return null;
};

const tryParseFlexible = (str) => {
  const s = str.trim().toLowerCase();
  // Try various formats
  for (const fmt of ["YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", "D MMMM YYYY", "D MMM YYYY", "MMMM D YYYY", "MMM D YYYY", "D MMMM", "D MMM"]) {
    const d = dayjs(s, fmt, true);
    if (d.isValid()) return d.format("YYYY-MM-DD");
  }
  // Try natural month+day
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (s.includes(name)) {
      const dayMatch = s.match(/(\d{1,2})/);
      if (dayMatch) {
        const year = dayjs().format("YYYY");
        return `${year}-${num}-${dayMatch[1].padStart(2, "0")}`;
      }
    }
  }
  return null;
};

// ─────────────────────────────────────────────
// Full database query functions
// ─────────────────────────────────────────────

/** Generic: fetch prices for a specific date */
const fetchPricesForDate = async (date, metals = ALL_METALS) => {
  const { data } = await supabase
    .from("metal_prices")
    .select("metal_name, price_1g, price_8g, price_per_kg, carat, date")
    .eq("date", date)
    .in("metal_name", metals);

  if (!data || data.length === 0) return null;

  const prices = {};
  data.forEach((row) => {
    if (row.metal_name === "XAU") {
      if (!prices.XAU) prices.XAU = {};
      if (row.carat && row.price_1g) {
        prices.XAU[row.carat] = { price_1g: row.price_1g, price_8g: row.price_8g };
      }
    } else if (row.price_1g) {
      prices[row.metal_name] = { price_1g: row.price_1g, price_per_kg: row.price_per_kg };
    }
  });

  return { date, prices };
};

/** Fetch the latest available date's prices */
const fetchLatestPrices = async (metals = ALL_METALS) => {
  const { data: latestDateRow } = await supabase
    .from("metal_prices")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);

  if (!latestDateRow?.length) return null;
  return fetchPricesForDate(latestDateRow[0].date, metals);
};

/** Fetch closest available date to a target (searches +/- 3 days) */
const fetchClosestDate = async (targetDate, metals = ALL_METALS) => {
  // Try exact date first
  const exact = await fetchPricesForDate(targetDate, metals);
  if (exact) return exact;

  // Search nearby dates
  const { data } = await supabase
    .from("metal_prices")
    .select("date")
    .gte("date", dayjs(targetDate).subtract(3, "day").format("YYYY-MM-DD"))
    .lte("date", dayjs(targetDate).add(3, "day").format("YYYY-MM-DD"))
    .order("date", { ascending: false })
    .limit(1);

  if (data?.length) return fetchPricesForDate(data[0].date, metals);
  return null;
};

/** Fetch price history for a date range */
const fetchDateRange = async (from, to, metals = ALL_METALS) => {
  let query = supabase
    .from("metal_prices")
    .select("metal_name, price_1g, carat, date")
    .gte("date", from)
    .lte("date", to)
    .in("metal_name", metals)
    .order("date", { ascending: true });

  const { data } = await query;
  if (!data?.length) return [];

  // Group by date
  const byDate = {};
  data.forEach((row) => {
    if (!byDate[row.date]) byDate[row.date] = {};
    if (row.metal_name === "XAU") {
      if (row.carat === "22" && row.price_1g) byDate[row.date].XAU = row.price_1g;
    } else if (row.price_1g) {
      byDate[row.date][row.metal_name] = row.price_1g;
    }
  });

  return Object.entries(byDate).map(([date, prices]) => ({ date, prices }));
};

/** Get all available dates in the database */
const fetchAvailableDateRange = async () => {
  const [{ data: oldest }, { data: newest }] = await Promise.all([
    supabase.from("metal_prices").select("date").order("date", { ascending: true }).limit(1),
    supabase.from("metal_prices").select("date").order("date", { ascending: false }).limit(1),
  ]);
  return {
    oldest: oldest?.[0]?.date || null,
    newest: newest?.[0]?.date || null,
  };
};

// ─────────────────────────────────────────────
// Metal & intent detection
// ─────────────────────────────────────────────

const detectMetals = (question) => {
  const q = question.toUpperCase();
  const found = [];
  ALL_METALS.forEach((sym) => { if (q.includes(sym)) found.push(sym); });

  const nameMap = { GOLD: "XAU", SILVER: "XAG", PLATINUM: "XPT", PALLADIUM: "XPD", COPPER: "XCU", LEAD: "LEAD", NICKEL: "NI", ZINC: "ZNC", ALUMINIUM: "ALU", ALUMINUM: "ALU" };
  Object.entries(nameMap).forEach(([name, sym]) => {
    if (q.includes(name) && !found.includes(sym)) found.push(sym);
  });

  return found;
};

const detectIntent = (question) => {
  const q = question.toLowerCase();
  if (q.includes("compare") || q.includes("vs") || q.includes("difference") || q.includes("versus")) return "compare";
  if (q.includes("trend") || q.includes("history") || q.includes("chart") || q.includes("movement")) return "trend";
  if (q.includes("cheapest") || q.includes("expensive") || q.includes("highest") || q.includes("lowest") || q.includes("rank")) return "rank";
  if (q.includes("average") || q.includes("avg") || q.includes("mean")) return "average";
  if (q.includes("all carat") || q.includes("all karat") || q.includes("carats") || q.includes("purity")) return "carats";
  if (q.includes("available") || q.includes("date range") || q.includes("how far") || q.includes("oldest")) return "daterange";
  if (q.includes("help") || q.includes("what can") || q.includes("what do") || q.includes("how to")) return "help";
  return "price";
};

// ─────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────

const fmtPrice = (p) => p != null ? `\u20B9${p.toFixed(2)}` : "N/A";

const formatGoldPrices = (goldData) => {
  if (!goldData || typeof goldData !== "object") return "Gold: N/A";
  const lines = [];
  const caratOrder = ["24", "22", "18", "14"];
  caratOrder.forEach((c) => {
    if (goldData[c]) lines.push(`  ${c}K: ${fmtPrice(goldData[c].price_1g)}/gram${goldData[c].price_8g ? ` | ${fmtPrice(goldData[c].price_8g)}/8g` : ""}`);
  });
  return lines.length > 0 ? `Gold:\n${lines.join("\n")}` : "Gold: N/A";
};

const formatMetalPrices = (prices, date) => {
  const lines = [`PRICES FOR ${date}:`];
  Object.entries(prices).forEach(([sym, data]) => {
    if (sym === "XAU") {
      lines.push(formatGoldPrices(data));
    } else if (METAL_NAMES[sym]) {
      const kg = data.price_per_kg ? ` | ${fmtPrice(data.price_per_kg)}/kg` : "";
      lines.push(`${METAL_NAMES[sym]}: ${fmtPrice(data.price_1g)}/gram${kg}`);
    }
  });
  return lines.join("\n");
};

// ─────────────────────────────────────────────
// Build context (all calculations done here)
// ─────────────────────────────────────────────

const buildContext = async (question) => {
  const intent = detectIntent(question);
  const metals = detectMetals(question);
  const dateInfo = parseDate(question);
  const targetMetals = metals.length > 0 ? metals : ALL_METALS;
  let contextParts = [];

  try {
    // Help intent
    if (intent === "help") {
      const range = await fetchAvailableDateRange();
      return `Auric Ledger tracks 9 metals: Gold (all carats: 24K, 22K, 18K, 14K), Silver, Platinum, Palladium, Copper, Lead, Nickel, Zinc, Aluminium.\n\nDatabase has prices from ${range.oldest} to ${range.newest}.\n\nYou can ask:\n- Price on any date (e.g., "gold price on 15 feb")\n- Date range (e.g., "silver prices last 7 days")\n- Compare dates (e.g., "compare gold prices from 20 feb to 25 feb")\n- Rankings (e.g., "which metal is cheapest today?")\n- Trends (e.g., "gold trend this week")\n- All gold carats (e.g., "all gold carat prices")`;
    }

    // Available date range query
    if (intent === "daterange") {
      const range = await fetchAvailableDateRange();
      return `Database has price records from ${range.oldest} to ${range.newest}.`;
    }

    // --- Date-specific single day ---
    if (dateInfo?.type === "single") {
      const result = await fetchClosestDate(dateInfo.date, targetMetals);
      if (!result) {
        const range = await fetchAvailableDateRange();
        return `No price data found for ${dateInfo.date} or nearby dates. Database has prices from ${range.oldest} to ${range.newest}.`;
      }
      const note = result.date !== dateInfo.date ? ` (closest available to ${dateInfo.date})` : "";
      contextParts.push(formatMetalPrices(result.prices, result.date + note));

      // If comparing with today
      if (intent === "compare") {
        const latest = await fetchLatestPrices(targetMetals);
        if (latest && latest.date !== result.date) {
          contextParts.push(formatMetalPrices(latest.prices, latest.date + " (latest)"));
          // Compute changes
          const changes = computeChanges(result.prices, latest.prices, result.date, latest.date);
          if (changes) contextParts.push(changes);
        }
      }

      return contextParts.join("\n\n");
    }

    // --- Date range ---
    if (dateInfo?.type === "range") {
      const history = await fetchDateRange(dateInfo.from, dateInfo.to, targetMetals);
      if (history.length === 0) {
        const range = await fetchAvailableDateRange();
        return `No price data found between ${dateInfo.from} and ${dateInfo.to}. Database has prices from ${range.oldest} to ${range.newest}.`;
      }

      // Show metal-by-metal summary for the range
      const primaryMetal = metals.length > 0 ? metals[0] : "XAU";
      const metalName = METAL_NAMES[primaryMetal] || primaryMetal;

      let lines = [`PRICE HISTORY FOR ${metalName} (${dateInfo.from} to ${dateInfo.to}):`];
      history.forEach((day) => {
        const p = day.prices[primaryMetal];
        if (p != null) lines.push(`  ${day.date}: ${fmtPrice(p)}/gram`);
      });

      // Statistics
      const vals = history.map((d) => d.prices[primaryMetal]).filter((v) => v != null);
      if (vals.length > 1) {
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const first = vals[0];
        const last = vals[vals.length - 1];
        const change = last - first;
        const pct = ((change / first) * 100).toFixed(2);
        lines.push(`\nLow: ${fmtPrice(min)} | High: ${fmtPrice(max)} | Avg: ${fmtPrice(avg)}`);
        lines.push(`Change: ${change > 0 ? "+" : ""}${fmtPrice(change)} (${pct}%) from first to last`);
      }

      contextParts.push(lines.join("\n"));

      // If multiple metals requested, show latest for all
      if (metals.length > 1 || metals.length === 0) {
        const lastDay = history[history.length - 1];
        const otherLines = [];
        targetMetals.forEach((sym) => {
          if (sym !== primaryMetal && lastDay.prices[sym] != null) {
            otherLines.push(`${METAL_NAMES[sym]}: ${fmtPrice(lastDay.prices[sym])}/gram`);
          }
        });
        if (otherLines.length > 0) contextParts.push(`OTHER METALS ON ${lastDay.date}:\n${otherLines.join("\n")}`);
      }

      return contextParts.join("\n\n");
    }

    // --- No specific date → use latest ---
    const latest = await fetchLatestPrices(targetMetals);
    if (!latest) return "No price data is currently available in the database.";

    // All carats
    if (intent === "carats" && latest.prices.XAU) {
      contextParts.push(`GOLD PRICES - ALL CARATS (${latest.date}):\n${formatGoldPrices(latest.prices.XAU)}`);
      return contextParts.join("\n\n");
    }

    // Current prices
    contextParts.push(formatMetalPrices(latest.prices, latest.date));

    // Compare intent → also fetch yesterday
    if (intent === "compare") {
      const yesterday = dayjs(latest.date).subtract(1, "day").format("YYYY-MM-DD");
      const yResult = await fetchClosestDate(yesterday, targetMetals);
      if (yResult) {
        contextParts.push(formatMetalPrices(yResult.prices, yResult.date + " (previous)"));
        const changes = computeChanges(yResult.prices, latest.prices, yResult.date, latest.date);
        if (changes) contextParts.push(changes);
      }
    }

    // Trend intent → fetch last 7 days
    if (intent === "trend") {
      const from = dayjs(latest.date).subtract(7, "day").format("YYYY-MM-DD");
      const history = await fetchDateRange(from, latest.date, targetMetals);
      if (history.length > 1) {
        const primaryMetal = metals.length > 0 ? metals[0] : "XAU";
        const vals = history.map((d) => d.prices[primaryMetal]).filter((v) => v != null);
        const hLines = history.map((d) => {
          const p = d.prices[primaryMetal];
          return p != null ? `  ${d.date}: ${fmtPrice(p)}/gram` : null;
        }).filter(Boolean);

        if (vals.length > 1) {
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          const change = vals[vals.length - 1] - vals[0];
          const pct = ((change / vals[0]) * 100).toFixed(2);
          contextParts.push(`WEEKLY TREND FOR ${METAL_NAMES[primaryMetal]}:\n${hLines.join("\n")}\n\nLow: ${fmtPrice(min)} | High: ${fmtPrice(max)}\nChange: ${change > 0 ? "+" : ""}${fmtPrice(change)} (${pct}%)`);
        }
      }
    }

    // Rank intent
    if (intent === "rank") {
      const flat = [];
      Object.entries(latest.prices).forEach(([sym, data]) => {
        if (sym === "XAU") {
          if (data?.["22"]?.price_1g) flat.push({ name: "Gold (22K)", price: data["22"].price_1g });
        } else if (METAL_NAMES[sym] && data?.price_1g) {
          flat.push({ name: METAL_NAMES[sym], price: data.price_1g });
        }
      });
      flat.sort((a, b) => a.price - b.price);
      contextParts.push(`METALS RANKED BY PRICE (${latest.date}):\n${flat.map((m, i) => `${i + 1}. ${m.name}: ${fmtPrice(m.price)}/gram`).join("\n")}`);
    }

    // Average intent → last 7 days avg
    if (intent === "average") {
      const from = dayjs(latest.date).subtract(7, "day").format("YYYY-MM-DD");
      const history = await fetchDateRange(from, latest.date, targetMetals);
      if (history.length > 0) {
        const primaryMetal = metals.length > 0 ? metals[0] : "XAU";
        const vals = history.map((d) => d.prices[primaryMetal]).filter((v) => v != null);
        if (vals.length > 0) {
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          contextParts.push(`7-DAY AVERAGE FOR ${METAL_NAMES[primaryMetal]}: ${fmtPrice(avg)}/gram (based on ${vals.length} data points)`);
        }
      }
    }

  } catch (err) {
    console.error("Error building context:", err);
    return "Error retrieving data from database.";
  }

  return contextParts.join("\n\n");
};

/** Compute price changes between two sets of prices */
const computeChanges = (oldPrices, newPrices, oldDate, newDate) => {
  const lines = [`PRICE CHANGES (${oldDate} → ${newDate}):`];
  let hasData = false;

  for (const sym of ALL_METALS) {
    const oldP = sym === "XAU" ? oldPrices.XAU?.["22"]?.price_1g : oldPrices[sym]?.price_1g;
    const newP = sym === "XAU" ? newPrices.XAU?.["22"]?.price_1g : newPrices[sym]?.price_1g;
    if (oldP && newP) {
      const change = newP - oldP;
      const pct = ((change / oldP) * 100).toFixed(2);
      const dir = change > 0 ? "UP" : change < 0 ? "DOWN" : "UNCHANGED";
      const name = sym === "XAU" ? "Gold (22K)" : METAL_NAMES[sym];
      lines.push(`${name}: ${dir} by ${fmtPrice(Math.abs(change))} (${pct}%)`);
      hasData = true;
    }
  }

  return hasData ? lines.join("\n") : null;
};

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Auric AI, the intelligent assistant for Auric Ledger - an Indian metal price tracking platform.

CRITICAL CURRENCY RULE:
- ALL prices are in INDIAN RUPEES. Use the ₹ symbol (₹) ALWAYS. Example: ₹14938.42/gram.
- NEVER use $, USD, dollars, or any other currency symbol. This is an Indian platform.
- Copy the exact price numbers from the context data. Do not convert or change them.

OTHER RULES:
- Answer ONLY using the data provided in the context. Never make up or guess prices.
- Keep answers concise but complete (3-6 sentences).
- Always mention the specific date the price data is from.
- If data says "closest available to DATE", explain that prices for the exact date weren't available and you're showing the nearest date.
- Use the pre-calculated statistics (changes, averages, etc.) provided - do NOT recalculate.
- For gold, mention the carat (22K, 24K, etc.) when relevant.
- Be professional but friendly.
- If the user asks something completely unrelated to metals/prices, politely redirect them.
- For greetings, introduce yourself briefly and mention you can help with metal prices on any date.`;

// ─────────────────────────────────────────────
// Non-streaming (for Telegram)
// ─────────────────────────────────────────────

export const askChatbot = async (question) => {
  try {
    const context = await buildContext(question);
    const userPrompt = `CONTEXT DATA:\n${context}\n\nUSER QUESTION: ${question}`;

    const response = await axios.post(
      HF_API_URL,
      {
        model: "auric-ai",
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 512,
        temperature: 0.3,
      },
      { headers: { "Content-Type": "application/json" }, timeout: 60000 }
    );

    const answer = response.data?.choices?.[0]?.message?.content || "I could not generate a response. Please try again.";
    return { answer, context_used: context.substring(0, 200) + "..." };
  } catch (err) {
    console.error("Chatbot error:", err.message);
    try {
      const context = await buildContext(question);
      return { answer: `I'm having trouble connecting to my AI engine, but here's the data I found:\n\n${context}`, context_used: "fallback" };
    } catch {
      return { answer: "Sorry, I'm unable to process your request right now. Please try again later.", context_used: "error" };
    }
  }
};

// ─────────────────────────────────────────────
// Streaming (for website - SSE)
// ─────────────────────────────────────────────

export const streamChatbot = async (question, res) => {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const context = await buildContext(question);
    const userPrompt = `CONTEXT DATA:\n${context}\n\nUSER QUESTION: ${question}`;

    const response = await axios.post(
      HF_API_URL,
      {
        model: "auric-ai",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 512,
        temperature: 0.3,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 60000,
        responseType: "stream",
      }
    );

    let buffer = "";

    response.data.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") {
          res.write("data: [DONE]\n\n");
          return;
        }
        try {
          const parsed = JSON.parse(payload);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
        } catch {
          // skip malformed chunks
        }
      }
    });

    response.data.on("end", () => {
      // Process remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
          } catch { /* skip */ }
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    });

    response.data.on("error", (err) => {
      console.error("Stream error:", err.message);
      res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });

    // Handle client disconnect
    res.on("close", () => {
      response.data.destroy();
    });

  } catch (err) {
    console.error("Stream chatbot error:", err.message);

    // Fallback: send context as non-streamed response
    try {
      const context = await buildContext(question);
      const fallback = `I'm having trouble connecting to my AI engine, but here's the data I found:\n\n${context}`;
      res.write(`data: ${JSON.stringify({ token: fallback })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ token: "Sorry, I'm unable to process your request right now." })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  }
};
