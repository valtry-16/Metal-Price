// ═══════════════════════════════════════════════════════════════
// Auric Ledger — Auric AI Chatbot (Embedding-Based Pipeline)
// ═══════════════════════════════════════════════════════════════
//
// Pipeline:
//   1. User question
//   2. Embed user question via HF Embedding API
//   3. Embed ALL candidate patterns via HF Embedding API
//   4. Cosine similarity → detect intent
//   5. Query Supabase DB based on intent
//   6. Build structured CONTEXT DATA
//   7. Send question + context to Auric LLM
//   8. Return precise answer (no hallucinated numbers)
//
// All numbers come from the database. The LLM only formats.
// ═══════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import dotenv from "dotenv";
import { INTENT_CANDIDATES, getRelevantKB } from "./knowledge-base.js";

dotenv.config();
dayjs.extend(customParseFormat);

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

const EMBEDDING_API_URL = "https://valtry-Auric-Intent.hf.space/v1/embeddings";
const LLM_API_URL = "https://valtry-auric-bot.hf.space/v1/chat/completions";

const METAL_NAMES = {
  XAU: "Gold", XAG: "Silver", XPT: "Platinum", XPD: "Palladium",
  XCU: "Copper", LEAD: "Lead", NI: "Nickel", ZNC: "Zinc", ALU: "Aluminium",
};
const ALL_METALS = Object.keys(METAL_NAMES);

// ─────────────────────────────────────────────
// Step 2 & 3 — Embedding + Cosine Similarity
// ─────────────────────────────────────────────

/** Call the HF embedding API for one or more strings */
const getEmbeddings = async (inputs) => {
  const inputArray = Array.isArray(inputs) ? inputs : [inputs];
  const response = await axios.post(
    EMBEDDING_API_URL,
    { input: inputArray },
    { headers: { "Content-Type": "application/json" }, timeout: 60000 }
  );
  // API returns { data: [{ embedding: [...] }, ...] }
  return response.data.data.map((d) => d.embedding);
};

/** Compute cosine similarity between two vectors */
const cosineSimilarity = (a, b) => {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
};

/**
 * Step 3 — Detect intent using embeddings.
 * Embeds user question + all candidates, finds highest cosine similarity.
 */
const detectIntentViaEmbedding = async (question) => {
  // Build the full input array: [user_question, ...all_candidate_questions]
  const allTexts = [question, ...INTENT_CANDIDATES.map((c) => c.question)];

  // Single API call to embed everything
  const allEmbeddings = await getEmbeddings(allTexts);

  const userEmbedding = allEmbeddings[0];
  const candidateEmbeddings = allEmbeddings.slice(1);

  // Compute similarities
  let bestScore = -1;
  let bestIntent = "price_query"; // fallback

  for (let i = 0; i < candidateEmbeddings.length; i++) {
    const score = cosineSimilarity(userEmbedding, candidateEmbeddings[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = INTENT_CANDIDATES[i].intent;
    }
  }

  console.log(`[Auric AI] Intent: ${bestIntent} (score: ${bestScore.toFixed(4)}) for: "${question}"`);
  return { intent: bestIntent, confidence: bestScore };
};

// ─────────────────────────────────────────────
// Date parsing — extract dates from natural language
// ─────────────────────────────────────────────

const MONTH_MAP = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
  aug: "08", august: "08", sep: "09", september: "09", oct: "10", october: "10",
  nov: "11", november: "11", dec: "12", december: "12",
};

const parseDate = (question) => {
  const q = question.toLowerCase().trim();
  const now = dayjs();

  if (/\btoday\b/.test(q)) return { type: "single", date: now.format("YYYY-MM-DD") };
  if (/\byesterday\b/.test(q)) return { type: "single", date: now.subtract(1, "day").format("YYYY-MM-DD") };
  if (/\b(last|past|this)\s+week\b/.test(q)) return { type: "range", from: now.subtract(7, "day").format("YYYY-MM-DD"), to: now.format("YYYY-MM-DD") };
  if (/\b(last|past)\s+month\b/.test(q)) return { type: "range", from: now.subtract(30, "day").format("YYYY-MM-DD"), to: now.format("YYYY-MM-DD") };

  const lastNDays = q.match(/\blast\s+(\d+)\s+days?\b/);
  if (lastNDays) return { type: "range", from: now.subtract(parseInt(lastNDays[1]), "day").format("YYYY-MM-DD"), to: now.format("YYYY-MM-DD") };

  const rangeMatch = q.match(/(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+?)(?:\s|$)/);
  if (rangeMatch) {
    const d1 = tryParseFlexible(rangeMatch[1]);
    const d2 = tryParseFlexible(rangeMatch[2]);
    if (d1 && d2) return { type: "range", from: d1, to: d2 };
  }

  const onDate = q.match(/(?:on|for|of|price\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/);
  if (onDate) {
    const day = onDate[1].padStart(2, "0");
    const month = MONTH_MAP[onDate[2]];
    const year = onDate[3] || now.format("YYYY");
    return { type: "single", date: `${year}-${month}-${day}` };
  }

  const monthFirst = q.match(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s*(\d{4})?/);
  if (monthFirst) {
    const day = monthFirst[2].padStart(2, "0");
    const month = MONTH_MAP[monthFirst[1]];
    const year = monthFirst[3] || now.format("YYYY");
    return { type: "single", date: `${year}-${month}-${day}` };
  }

  const isoDate = q.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoDate) return { type: "single", date: `${isoDate[1]}-${isoDate[2].padStart(2, "0")}-${isoDate[3].padStart(2, "0")}` };

  const dmyDate = q.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyDate) return { type: "single", date: `${dmyDate[3]}-${dmyDate[2].padStart(2, "0")}-${dmyDate[1].padStart(2, "0")}` };

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
  for (const fmt of ["YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", "D MMMM YYYY", "D MMM YYYY", "MMMM D YYYY", "MMM D YYYY", "D MMMM", "D MMM"]) {
    const d = dayjs(s, fmt, true);
    if (d.isValid()) return d.format("YYYY-MM-DD");
  }
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (s.includes(name)) {
      const dayMatch = s.match(/(\d{1,2})/);
      if (dayMatch) return `${dayjs().format("YYYY")}-${num}-${dayMatch[1].padStart(2, "0")}`;
    }
  }
  return null;
};

// ─────────────────────────────────────────────
// Step 4 — Database query functions
// ─────────────────────────────────────────────

/** Fetch prices for a specific date */
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
      if (row.carat && row.price_1g) prices.XAU[row.carat] = { price_1g: row.price_1g, price_8g: row.price_8g };
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
  const exact = await fetchPricesForDate(targetDate, metals);
  if (exact) return exact;
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
  const { data } = await supabase
    .from("metal_prices")
    .select("metal_name, price_1g, carat, date")
    .gte("date", from)
    .lte("date", to)
    .in("metal_name", metals)
    .order("date", { ascending: true });

  if (!data?.length) return [];
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

/** Get oldest and newest dates in the database */
const fetchAvailableDateRange = async () => {
  const [{ data: oldest }, { data: newest }] = await Promise.all([
    supabase.from("metal_prices").select("date").order("date", { ascending: true }).limit(1),
    supabase.from("metal_prices").select("date").order("date", { ascending: false }).limit(1),
  ]);
  return { oldest: oldest?.[0]?.date || null, newest: newest?.[0]?.date || null };
};

/** Fetch latest daily summary */
const fetchDailySummary = async () => {
  const { data } = await supabase
    .from("daily_summaries")
    .select("summary, generated_at")
    .order("generated_at", { ascending: false })
    .limit(1);
  return data?.[0] || null;
};

// ─────────────────────────────────────────────
// Metal detection (keyword-based — works alongside intent)
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

// ─────────────────────────────────────────────
// Step 5 — Format helpers
// ─────────────────────────────────────────────

/** Format price in Indian Rupee with Indian numbering */
const fmtPrice = (p) => {
  if (p == null) return "N/A";
  const fixed = p.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  let result = intPart.slice(-3);
  let remaining = intPart.slice(0, -3);
  while (remaining.length > 0) {
    result = remaining.slice(-2) + "," + result;
    remaining = remaining.slice(0, -2);
  }
  return `₹${result}.${decPart}`;
};

/** Format gold prices — ONLY per gram */
const formatGoldPrices = (goldData) => {
  if (!goldData || typeof goldData !== "object") return "Gold: data not available";
  const lines = [];
  ["24", "22", "18", "14"].forEach((c) => {
    if (goldData[c]?.price_1g) lines.push(`Gold ${c}K = ${fmtPrice(goldData[c].price_1g)} per gram`);
  });
  return lines.length > 0 ? lines.join("\n") : "Gold: data not available";
};

/** Format all metal prices */
const formatMetalPrices = (prices, date) => {
  const lines = [`Date: ${date}`, "---"];
  Object.entries(prices).forEach(([sym, data]) => {
    if (sym === "XAU") lines.push(formatGoldPrices(data));
    else if (METAL_NAMES[sym] && data?.price_1g) lines.push(`${METAL_NAMES[sym]} = ${fmtPrice(data.price_1g)} per gram`);
  });
  return lines.join("\n");
};

/** Compute price changes between two sets */
const computeChanges = (oldPrices, newPrices, oldDate, newDate) => {
  const lines = [`Price changes (${oldDate} → ${newDate}):`];
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
// Step 5 — Context builder (database → structured text)
// ─────────────────────────────────────────────

const buildContext = async (question, intent) => {
  const metals = detectMetals(question);
  const dateInfo = parseDate(question);
  const targetMetals = metals.length > 0 ? metals : ALL_METALS;
  let contextParts = [];
  let suggestedAnswer = "";

  try {
    // ── greeting ──
    if (intent === "greeting") {
      return { context: "", suggestedAnswer: "", intent };
    }

    // ── knowledge_query ──
    if (intent === "knowledge_query") {
      return { context: "", suggestedAnswer: "", intent };
    }

    // ── summary_query ──
    if (intent === "summary_query") {
      const summary = await fetchDailySummary();
      if (summary) {
        suggestedAnswer = summary.summary;
        contextParts.push(`DAILY MARKET SUMMARY (generated ${summary.generated_at}):\n${summary.summary}`);
      } else {
        suggestedAnswer = "No daily summary is available yet. Please check back later.";
      }
      return { context: contextParts.join("\n\n"), suggestedAnswer, intent };
    }

    // ── Available date range ──
    const range = await fetchAvailableDateRange();

    // ── Date-specific single day ──
    if (dateInfo?.type === "single") {
      const result = await fetchClosestDate(dateInfo.date, targetMetals);
      if (!result) {
        suggestedAnswer = `Sorry, no price data found for ${dateInfo.date}. Our database has prices from ${range.oldest} to ${range.newest}.`;
        return { context: suggestedAnswer, suggestedAnswer, intent };
      }
      const closestNote = result.date !== dateInfo.date ? ` (closest to ${dateInfo.date})` : "";
      contextParts.push(formatMetalPrices(result.prices, result.date + closestNote));

      // Build suggested answer
      if (metals.length <= 1) {
        const m = metals.length === 1 ? metals[0] : "XAU";
        if (m === "XAU" && result.prices.XAU) {
          const caratLines = [];
          ["24", "22", "18", "14"].forEach((c) => {
            if (result.prices.XAU[c]?.price_1g) caratLines.push(`${c}K: ${fmtPrice(result.prices.XAU[c].price_1g)} per gram`);
          });
          suggestedAnswer = `Gold prices on ${result.date}${closestNote}:\n${caratLines.join("\n")}`;
        } else if (METAL_NAMES[m] && result.prices[m]?.price_1g) {
          suggestedAnswer = `${METAL_NAMES[m]} price on ${result.date}${closestNote}: ${fmtPrice(result.prices[m].price_1g)} per gram.`;
        }
      }

      // Comparison: also fetch today's
      if (intent === "comparison_query") {
        const latest = await fetchLatestPrices(targetMetals);
        if (latest && latest.date !== result.date) {
          contextParts.push(formatMetalPrices(latest.prices, latest.date + " (latest)"));
          const changes = computeChanges(result.prices, latest.prices, result.date, latest.date);
          if (changes) contextParts.push(changes);
        }
      }

      return { context: contextParts.join("\n\n"), suggestedAnswer, intent };
    }

    // ── Date range ──
    if (dateInfo?.type === "range") {
      const history = await fetchDateRange(dateInfo.from, dateInfo.to, targetMetals);
      if (history.length === 0) {
        suggestedAnswer = `No price data found between ${dateInfo.from} and ${dateInfo.to}. Database has prices from ${range.oldest} to ${range.newest}.`;
        return { context: suggestedAnswer, suggestedAnswer, intent };
      }

      const primaryMetal = metals.length > 0 ? metals[0] : "XAU";
      const metalName = METAL_NAMES[primaryMetal] || primaryMetal;
      let lines = [`${metalName} price history (${dateInfo.from} to ${dateInfo.to}):`];
      history.forEach((day) => {
        const p = day.prices[primaryMetal];
        if (p != null) lines.push(`${day.date}: ${fmtPrice(p)} per gram`);
      });

      const vals = history.map((d) => d.prices[primaryMetal]).filter((v) => v != null);
      if (vals.length > 1) {
        const min = Math.min(...vals), max = Math.max(...vals);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const first = vals[0], last = vals[vals.length - 1];
        const change = last - first;
        const pct = ((change / first) * 100).toFixed(2);
        lines.push(`\nLowest: ${fmtPrice(min)} | Highest: ${fmtPrice(max)} | Average: ${fmtPrice(avg)}`);
        lines.push(`Change: ${change > 0 ? "+" : ""}${fmtPrice(change)} (${pct}%)`);
        suggestedAnswer = `${metalName} from ${dateInfo.from} to ${dateInfo.to}: Lowest ${fmtPrice(min)}, Highest ${fmtPrice(max)}, Average ${fmtPrice(avg)} per gram. Overall change: ${change > 0 ? "+" : ""}${fmtPrice(change)} (${pct}%).`;
      }

      contextParts.push(lines.join("\n"));
      return { context: contextParts.join("\n\n"), suggestedAnswer, intent };
    }

    // ── No specific date → use latest ──
    const latest = await fetchLatestPrices(targetMetals);
    if (!latest) return { context: "No price data is currently available.", suggestedAnswer: "Sorry, no price data is currently available in our database.", intent };

    // Current prices
    contextParts.push(formatMetalPrices(latest.prices, latest.date));

    // Build suggested answer for price queries
    if (intent === "price_query") {
      if (metals.length === 1) {
        const m = metals[0];
        if (m === "XAU" && latest.prices.XAU) {
          const caratLines = [];
          ["24", "22", "18", "14"].forEach((c) => {
            if (latest.prices.XAU[c]?.price_1g) caratLines.push(`${c}K: ${fmtPrice(latest.prices.XAU[c].price_1g)} per gram`);
          });
          suggestedAnswer = `Latest gold prices (${latest.date}):\n${caratLines.join("\n")}`;
        } else if (METAL_NAMES[m] && latest.prices[m]?.price_1g) {
          suggestedAnswer = `Latest ${METAL_NAMES[m]} price (${latest.date}): ${fmtPrice(latest.prices[m].price_1g)} per gram.`;
        }
      } else if (metals.length === 0) {
        const allLines = [];
        Object.entries(latest.prices).forEach(([sym, data]) => {
          if (sym === "XAU" && data?.["22"]?.price_1g) allLines.push(`Gold (22K): ${fmtPrice(data["22"].price_1g)} per gram`);
          else if (METAL_NAMES[sym] && data?.price_1g) allLines.push(`${METAL_NAMES[sym]}: ${fmtPrice(data.price_1g)} per gram`);
        });
        suggestedAnswer = `Latest metal prices (${latest.date}):\n${allLines.join("\n")}`;
      }
    }

    // Comparison query → fetch yesterday + rank
    if (intent === "comparison_query") {
      // Rank
      const flat = [];
      Object.entries(latest.prices).forEach(([sym, data]) => {
        if (sym === "XAU") { if (data?.["22"]?.price_1g) flat.push({ name: "Gold (22K)", price: data["22"].price_1g }); }
        else if (METAL_NAMES[sym] && data?.price_1g) flat.push({ name: METAL_NAMES[sym], price: data.price_1g });
      });
      flat.sort((a, b) => a.price - b.price);
      const rankLines = flat.map((m, i) => `${i + 1}. ${m.name}: ${fmtPrice(m.price)} per gram`);
      contextParts.push(`Metals ranked by price (${latest.date}):\n${rankLines.join("\n")}`);

      // Yesterday comparison
      const yesterday = dayjs(latest.date).subtract(1, "day").format("YYYY-MM-DD");
      const yResult = await fetchClosestDate(yesterday, targetMetals);
      if (yResult) {
        contextParts.push(formatMetalPrices(yResult.prices, yResult.date + " (previous)"));
        const changes = computeChanges(yResult.prices, latest.prices, yResult.date, latest.date);
        if (changes) contextParts.push(changes);
      }

      suggestedAnswer = `Metal prices ranked cheapest to most expensive (${latest.date}):\n${rankLines.join("\n")}`;
    }

    // Trend query → fetch last 7 days
    if (intent === "trend_query") {
      const from = dayjs(latest.date).subtract(7, "day").format("YYYY-MM-DD");
      const history = await fetchDateRange(from, latest.date, targetMetals);
      if (history.length > 1) {
        const primaryMetal = metals.length > 0 ? metals[0] : "XAU";
        const vals = history.map((d) => d.prices[primaryMetal]).filter((v) => v != null);
        const hLines = history.map((d) => {
          const p = d.prices[primaryMetal];
          return p != null ? `${d.date}: ${fmtPrice(p)} per gram` : null;
        }).filter(Boolean);

        if (vals.length > 1) {
          const min = Math.min(...vals), max = Math.max(...vals);
          const change = vals[vals.length - 1] - vals[0];
          const pct = ((change / vals[0]) * 100).toFixed(2);
          contextParts.push(`${METAL_NAMES[primaryMetal]} 7-day trend:\n${hLines.join("\n")}\n\nLowest: ${fmtPrice(min)} | Highest: ${fmtPrice(max)}\nChange: ${change > 0 ? "+" : ""}${fmtPrice(change)} (${pct}%)`);
          suggestedAnswer = `${METAL_NAMES[primaryMetal]} 7-day trend (${from} to ${latest.date}): Lowest ${fmtPrice(min)}, Highest ${fmtPrice(max)}. Overall ${change > 0 ? "up" : "down"} by ${fmtPrice(Math.abs(change))} (${pct}%).`;
        }
      }
    }

  } catch (err) {
    console.error("[Auric AI] Error building context:", err);
    return { context: "Error retrieving data from database.", suggestedAnswer: "Sorry, there was an error retrieving data. Please try again.", intent };
  }

  return { context: contextParts.join("\n\n"), suggestedAnswer, intent };
};

// ─────────────────────────────────────────────
// Step 6 — System prompt + user prompt construction
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Auric AI, the concise assistant for Auric Ledger — an Indian metal price tracker.

STRICT RULES:
1. ALL prices are Indian Rupees (₹). NEVER use $ or USD.
2. ONLY use data from CONTEXT DATA. NEVER invent or estimate prices.
3. Copy exact ₹ amounts — do NOT round or change any number.
4. Keep responses short (2–4 sentences). State facts, then stop.
5. Always mention the date when quoting a price.
6. For gold, always include carat (24K, 22K, etc).
7. Use "per gram" format.
8. If a SUGGESTED ANSWER is provided, use it as your base — keep all numbers identical.
9. If SITE INFO is provided, answer the question using that information.
10. If question is unrelated to metals or this site, say: "I can only help with metal prices and Auric Ledger."`;

/** Build the user prompt — injects KB for knowledge/greeting, otherwise uses context data */
const buildUserPrompt = (question, context, suggestedAnswer, intent) => {
  const kbSnippet = getRelevantKB(intent, question);
  const parts = [];

  if (kbSnippet) parts.push(`SITE INFO:\n${kbSnippet}`);
  if (context) parts.push(`CONTEXT DATA:\n${context}`);
  if (suggestedAnswer) parts.push(`SUGGESTED ANSWER:\n${suggestedAnswer}`);
  parts.push(`USER QUESTION: ${question}`);

  return parts.join("\n\n");
};

// ─────────────────────────────────────────────
// Step 7 — LLM call variants
// ─────────────────────────────────────────────

/**
 * Non-streaming response (for Telegram /ask)
 */
export const askChatbot = async (question) => {
  try {
    // Step 2+3: Embed question + candidates → detect intent
    const { intent } = await detectIntentViaEmbedding(question);

    // Step 4+5: Query DB + build context
    const { context, suggestedAnswer } = await buildContext(question, intent);

    // Step 6: Build prompt
    const userPrompt = buildUserPrompt(question, context, suggestedAnswer, intent);

    // Step 7: Call LLM
    const response = await axios.post(
      LLM_API_URL,
      {
        model: "auric-ai",
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 512,
        temperature: 0.1,
      },
      { headers: { "Content-Type": "application/json" }, timeout: 60000 }
    );

    const answer = response.data?.choices?.[0]?.message?.content || suggestedAnswer || "I could not generate a response. Please try again.";
    return { answer, context_used: context.substring(0, 200) + "..." };
  } catch (err) {
    console.error("[Auric AI] askChatbot error:", err.message);
    // Fallback: try to at least return DB data
    try {
      const { context, suggestedAnswer } = await buildContext(question, "price_query");
      return { answer: suggestedAnswer || `Here's the data I found:\n\n${context}`, context_used: "fallback" };
    } catch {
      return { answer: "Sorry, I'm unable to process your request right now. Please try again in a moment.", context_used: "error" };
    }
  }
};

/**
 * Callback-based streaming (for Telegram live edits)
 */
export const askChatbotStream = async (question, onToken) => {
  try {
    const { intent } = await detectIntentViaEmbedding(question);
    const { context, suggestedAnswer } = await buildContext(question, intent);
    const userPrompt = buildUserPrompt(question, context, suggestedAnswer, intent);

    const response = await axios.post(
      LLM_API_URL,
      {
        model: "auric-ai",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 512,
        temperature: 0.1,
      },
      { headers: { "Content-Type": "application/json" }, timeout: 60000, responseType: "stream" }
    );

    let fullText = "";
    let buffer = "";

    return new Promise((resolve, reject) => {
      response.data.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") return;
          try {
            const parsed = JSON.parse(payload);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              onToken(fullText);
            }
          } catch { /* skip */ }
        }
      });

      response.data.on("end", () => {
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) { fullText += token; onToken(fullText); }
            } catch { /* skip */ }
          }
        }
        resolve(fullText || suggestedAnswer || "Sorry, I couldn't generate a response.");
      });

      response.data.on("error", (err) => {
        console.error("[Auric AI] Stream callback error:", err.message);
        resolve(fullText || suggestedAnswer || "Sorry, stream was interrupted.");
      });
    });
  } catch (err) {
    console.error("[Auric AI] askChatbotStream error:", err.message);
    try {
      const { suggestedAnswer, context } = await buildContext(question, "price_query");
      return suggestedAnswer || `Here's the data I found:\n\n${context}`;
    } catch {
      return "Sorry, I'm unable to process your request right now. Please try again in a moment.";
    }
  }
};

/**
 * SSE streaming (for website chat)
 */
export const streamChatbot = async (question, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const { intent } = await detectIntentViaEmbedding(question);
    const { context, suggestedAnswer } = await buildContext(question, intent);
    const userPrompt = buildUserPrompt(question, context, suggestedAnswer, intent);

    const response = await axios.post(
      LLM_API_URL,
      {
        model: "auric-ai",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 512,
        temperature: 0.1,
      },
      { headers: { "Content-Type": "application/json" }, timeout: 60000, responseType: "stream" }
    );

    let buffer = "";

    response.data.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") { res.write("data: [DONE]\n\n"); return; }
        try {
          const parsed = JSON.parse(payload);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
        } catch { /* skip */ }
      }
    });

    response.data.on("end", () => {
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
      console.error("[Auric AI] Stream error:", err.message);
      res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });

    res.on("close", () => { response.data.destroy(); });

  } catch (err) {
    console.error("[Auric AI] streamChatbot error:", err.message);
    try {
      const { context, suggestedAnswer } = await buildContext(question, "price_query");
      const fallback = suggestedAnswer || `Here's the data I found:\n\n${context}`;
      res.write(`data: ${JSON.stringify({ token: fallback })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ token: "Sorry, I'm unable to process your request right now. Please try again in a moment." })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  }
};
