import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

const HF_API_URL = "https://valtry-auric-bot.hf.space/v1/chat/completions";

const METAL_NAMES = {
  XAU: "Gold (22K)",
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
// Data retrieval helpers (all calculations here)
// ─────────────────────────────────────────────

/** Fetch today's (latest) prices from Supabase */
const fetchLatestPrices = async () => {
  const { data: latestDateRow } = await supabase
    .from("metal_prices")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);

  if (!latestDateRow || latestDateRow.length === 0) return null;

  const latestDate = latestDateRow[0].date;

  const { data } = await supabase
    .from("metal_prices")
    .select("metal_name, price_1g, carat, date")
    .eq("date", latestDate);

  if (!data) return null;

  const prices = {};
  data.forEach((row) => {
    if (!ALL_METALS.includes(row.metal_name)) return;
    if (row.metal_name === "XAU") {
      if (row.carat === "22" && row.price_1g) prices.XAU = row.price_1g;
      return;
    }
    if (!prices[row.metal_name] && row.price_1g) {
      prices[row.metal_name] = row.price_1g;
    }
  });

  return { date: latestDate, prices };
};

/** Fetch yesterday's prices */
const fetchYesterdayPrices = async () => {
  const today = dayjs().format("YYYY-MM-DD");

  const { data } = await supabase
    .from("metal_prices")
    .select("metal_name, price_1g, carat, date")
    .lt("date", today)
    .order("date", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return null;

  const yesterdayDate = data[0].date;
  const filtered = data.filter((r) => r.date === yesterdayDate);

  const prices = {};
  filtered.forEach((row) => {
    if (!ALL_METALS.includes(row.metal_name)) return;
    if (row.metal_name === "XAU") {
      if (row.carat === "22" && row.price_1g) prices.XAU = row.price_1g;
      return;
    }
    if (!prices[row.metal_name] && row.price_1g) {
      prices[row.metal_name] = row.price_1g;
    }
  });

  return { date: yesterdayDate, prices };
};

/** Fetch weekly history for a metal */
const fetchWeeklyHistory = async (metalSymbol) => {
  const query = supabase
    .from("metal_prices")
    .select("date, price_1g, carat")
    .eq("metal_name", metalSymbol)
    .order("date", { ascending: false })
    .limit(7);

  if (metalSymbol === "XAU") query.eq("carat", "22");

  const { data } = await query;
  if (!data) return [];

  // Deduplicate by date
  const seen = new Set();
  return data
    .filter((r) => {
      if (seen.has(r.date) || !r.price_1g) return false;
      seen.add(r.date);
      return true;
    })
    .reverse();
};

/** Detect which metals user is asking about */
const detectMetals = (question) => {
  const q = question.toUpperCase();
  const found = [];

  // Check symbol names
  ALL_METALS.forEach((sym) => {
    if (q.includes(sym)) found.push(sym);
  });

  // Check common names
  const nameMap = {
    GOLD: "XAU",
    SILVER: "XAG",
    PLATINUM: "XPT",
    PALLADIUM: "XPD",
    COPPER: "XCU",
    LEAD: "LEAD",
    NICKEL: "NI",
    ZINC: "ZNC",
    ALUMINIUM: "ALU",
    ALUMINUM: "ALU",
  };

  Object.entries(nameMap).forEach(([name, sym]) => {
    if (q.includes(name) && !found.includes(sym)) found.push(sym);
  });

  return found;
};

/** Detect intent from user question */
const detectIntent = (question) => {
  const q = question.toLowerCase();

  if (q.includes("yesterday") || q.includes("previous")) return "yesterday";
  if (q.includes("compare") || q.includes("change") || q.includes("difference") || q.includes("vs"))
    return "compare";
  if (q.includes("trend") || q.includes("week") || q.includes("history") || q.includes("last 7"))
    return "trend";
  if (q.includes("cheapest") || q.includes("expensive") || q.includes("highest") || q.includes("lowest"))
    return "rank";
  if (
    q.includes("price") ||
    q.includes("rate") ||
    q.includes("cost") ||
    q.includes("how much") ||
    q.includes("current") ||
    q.includes("today")
  )
    return "current";
  if (q.includes("help") || q.includes("what can") || q.includes("what do")) return "help";

  return "general";
};

// ─────────────────────────────────────────────
// Build context data (all math done here)
// ─────────────────────────────────────────────

const buildContext = async (question) => {
  const intent = detectIntent(question);
  const metals = detectMetals(question);
  let contextParts = [];

  try {
    if (intent === "help") {
      return "This is Auric Ledger, a metal price tracking platform. It tracks: Gold (22K), Silver, Platinum, Palladium, Copper, Lead, Nickel, Zinc, Aluminium. Users can check current prices, compare with yesterday, view weekly trends, download PDF reports, and set price alerts.";
    }

    // Always fetch latest prices
    const latest = await fetchLatestPrices();
    if (!latest) return "No price data is currently available in the database.";

    // Current prices
    const targetMetals = metals.length > 0 ? metals : ALL_METALS;
    let priceLines = [];
    targetMetals.forEach((sym) => {
      if (latest.prices[sym]) {
        priceLines.push(
          `${METAL_NAMES[sym]}: Rs.${latest.prices[sym].toFixed(2)}/gram`
        );
      }
    });
    contextParts.push(
      `TODAY'S PRICES (${latest.date}):\n${priceLines.join("\n")}`
    );

    // Yesterday / compare
    if (intent === "yesterday" || intent === "compare") {
      const yesterday = await fetchYesterdayPrices();
      if (yesterday) {
        let yLines = [];
        targetMetals.forEach((sym) => {
          if (yesterday.prices[sym]) {
            yLines.push(
              `${METAL_NAMES[sym]}: Rs.${yesterday.prices[sym].toFixed(2)}/gram`
            );
          }
        });
        contextParts.push(
          `YESTERDAY'S PRICES (${yesterday.date}):\n${yLines.join("\n")}`
        );

        // Pre-calculated changes
        let changeLines = [];
        targetMetals.forEach((sym) => {
          if (latest.prices[sym] && yesterday.prices[sym]) {
            const change = latest.prices[sym] - yesterday.prices[sym];
            const pct = ((change / yesterday.prices[sym]) * 100).toFixed(2);
            const dir = change > 0 ? "UP" : change < 0 ? "DOWN" : "UNCHANGED";
            changeLines.push(
              `${METAL_NAMES[sym]}: ${dir} by Rs.${Math.abs(change).toFixed(2)} (${pct}%)`
            );
          }
        });
        if (changeLines.length > 0) {
          contextParts.push(`PRICE CHANGES:\n${changeLines.join("\n")}`);
        }
      }
    }

    // Weekly trend
    if (intent === "trend") {
      const trendMetal = metals.length > 0 ? metals[0] : "XAU";
      const history = await fetchWeeklyHistory(trendMetal);
      if (history.length > 0) {
        const hLines = history.map(
          (r) => `${r.date}: Rs.${r.price_1g.toFixed(2)}/gram`
        );
        const prices = history.map((r) => r.price_1g);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const first = prices[0];
        const last = prices[prices.length - 1];
        const weekChange = last - first;
        const weekPct = ((weekChange / first) * 100).toFixed(2);

        contextParts.push(
          `WEEKLY TREND FOR ${METAL_NAMES[trendMetal]} (last ${history.length} days):\n${hLines.join("\n")}\n\nWeek Low: Rs.${min.toFixed(2)} | Week High: Rs.${max.toFixed(2)}\nWeekly Change: Rs.${weekChange.toFixed(2)} (${weekPct}%)`
        );
      }
    }

    // Rank (cheapest / most expensive)
    if (intent === "rank") {
      const sorted = Object.entries(latest.prices)
        .map(([sym, price]) => ({ name: METAL_NAMES[sym], price }))
        .sort((a, b) => a.price - b.price);

      contextParts.push(
        `METALS RANKED BY PRICE (low to high):\n${sorted
          .map((m, i) => `${i + 1}. ${m.name}: Rs.${m.price.toFixed(2)}/gram`)
          .join("\n")}`
      );
    }
  } catch (err) {
    console.error("Error building context:", err);
    return "Error retrieving data from database.";
  }

  return contextParts.join("\n\n");
};

// ─────────────────────────────────────────────
// Call Hugging Face Space
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Auric AI, the intelligent assistant for Auric Ledger - a premium metal price tracking platform.

RULES:
- Answer ONLY using the data provided in the context. Never make up prices.
- All prices are in Indian Rupees (Rs.) per gram unless stated otherwise.
- Keep answers concise (2-4 sentences for simple queries, up to 6 for comparisons/trends).
- For prices, always mention the date the data is from.
- If the user asks something unrelated to metals or prices, politely redirect them.
- Use the pre-calculated percentages and changes provided - do NOT recalculate.
- Be professional but friendly. You represent a premium financial data service.
- For greetings, introduce yourself briefly and mention you can help with metal prices.`;

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
        max_tokens: 300,
        temperature: 0.3,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    const answer =
      response.data?.choices?.[0]?.message?.content ||
      "I could not generate a response. Please try again.";

    return { answer, context_used: context.substring(0, 200) + "..." };
  } catch (err) {
    console.error("Chatbot error:", err.message);

    // Fallback: return raw data if LLM is down
    try {
      const context = await buildContext(question);
      return {
        answer: `I'm having trouble connecting to my AI engine, but here's the data I found:\n\n${context}`,
        context_used: "fallback",
      };
    } catch {
      return {
        answer: "Sorry, I'm unable to process your request right now. Please try again later.",
        context_used: "error",
      };
    }
  }
};
