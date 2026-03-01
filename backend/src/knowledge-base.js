// ═══════════════════════════════════════════════════════════════
// Auric Ledger — Vector Knowledge Base for Auric AI
// ═══════════════════════════════════════════════════════════════
// Each intent has multiple candidate questions for semantic
// matching via cosine similarity with embedding vectors.
// Embeddings are pre-computed at startup and cached in memory.
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// Intent candidate patterns (10-15 per intent)
// ─────────────────────────────────────────────

export const INTENT_CANDIDATES = [
  // ── price_query ──────────────────────────
  { intent: "price_query", question: "What is today's gold price?" },
  { intent: "price_query", question: "Gold price today" },
  { intent: "price_query", question: "How much is silver right now?" },
  { intent: "price_query", question: "Current platinum price per gram" },
  { intent: "price_query", question: "What is the latest price of palladium?" },
  { intent: "price_query", question: "Tell me the copper price" },
  { intent: "price_query", question: "Show me today's metal prices" },
  { intent: "price_query", question: "What are all metal prices today?" },
  { intent: "price_query", question: "Gold rate today in India" },
  { intent: "price_query", question: "Price of zinc per gram" },
  { intent: "price_query", question: "How much does aluminium cost?" },
  { intent: "price_query", question: "Lead price today" },
  { intent: "price_query", question: "Nickel rate per gram" },
  { intent: "price_query", question: "What was gold price on 22 February?" },
  { intent: "price_query", question: "Silver price yesterday" },

  // ── trend_query ──────────────────────────
  { intent: "trend_query", question: "How did gold move this week?" },
  { intent: "trend_query", question: "Gold price trend last 7 days" },
  { intent: "trend_query", question: "Show me silver trend" },
  { intent: "trend_query", question: "How has platinum performed recently?" },
  { intent: "trend_query", question: "Is gold going up or down?" },
  { intent: "trend_query", question: "Weekly gold movement" },
  { intent: "trend_query", question: "Price history of copper this month" },
  { intent: "trend_query", question: "How has palladium changed over the last week?" },
  { intent: "trend_query", question: "What is the gold price trend?" },
  { intent: "trend_query", question: "Silver movement this week" },
  { intent: "trend_query", question: "Show me the price chart for gold" },
  { intent: "trend_query", question: "How did metals perform last week?" },
  { intent: "trend_query", question: "Is silver getting cheaper?" },

  // ── comparison_query ─────────────────────
  { intent: "comparison_query", question: "Compare gold and silver prices" },
  { intent: "comparison_query", question: "Gold vs silver" },
  { intent: "comparison_query", question: "Which is more expensive gold or platinum?" },
  { intent: "comparison_query", question: "Difference between gold and palladium price" },
  { intent: "comparison_query", question: "Compare all metal prices" },
  { intent: "comparison_query", question: "Rank metals by price" },
  { intent: "comparison_query", question: "Which metal is cheapest?" },
  { intent: "comparison_query", question: "Which metal is most expensive?" },
  { intent: "comparison_query", question: "Gold versus platinum comparison" },
  { intent: "comparison_query", question: "Silver vs copper price difference" },
  { intent: "comparison_query", question: "How does gold compare to silver today?" },
  { intent: "comparison_query", question: "List metals from cheapest to expensive" },

  // ── knowledge_query ──────────────────────
  { intent: "knowledge_query", question: "What is Auric Ledger?" },
  { intent: "knowledge_query", question: "Who built this app?" },
  { intent: "knowledge_query", question: "What features does Auric Ledger have?" },
  { intent: "knowledge_query", question: "How is the gold price calculated?" },
  { intent: "knowledge_query", question: "What is the price formula?" },
  { intent: "knowledge_query", question: "How do you calculate the final price?" },
  { intent: "knowledge_query", question: "Why does gold price change?" },
  { intent: "knowledge_query", question: "What metals are tracked?" },
  { intent: "knowledge_query", question: "Tell me about the Telegram bot" },
  { intent: "knowledge_query", question: "How to set price alerts?" },
  { intent: "knowledge_query", question: "How to subscribe to email updates?" },
  { intent: "knowledge_query", question: "What is 22K gold?" },
  { intent: "knowledge_query", question: "Explain gold carat purity" },
  { intent: "knowledge_query", question: "What can you do?" },
  { intent: "knowledge_query", question: "How to install the app?" },

  // ── summary_query ────────────────────────
  { intent: "summary_query", question: "Show me today's market summary" },
  { intent: "summary_query", question: "Daily summary" },
  { intent: "summary_query", question: "Give me the AI market summary" },
  { intent: "summary_query", question: "What is the market analysis for today?" },
  { intent: "summary_query", question: "Market overview" },
  { intent: "summary_query", question: "Show daily market report" },
  { intent: "summary_query", question: "Summarize today's metal market" },
  { intent: "summary_query", question: "What happened in the metal market today?" },
  { intent: "summary_query", question: "Today's metal market summary" },
  { intent: "summary_query", question: "Give me a brief on metal prices today" },
  { intent: "summary_query", question: "AI summary of metals" },
  { intent: "summary_query", question: "Daily report" },

  // ── greeting ─────────────────────────────
  { intent: "greeting", question: "Hi" },
  { intent: "greeting", question: "Hello" },
  { intent: "greeting", question: "Hey there" },
  { intent: "greeting", question: "Good morning" },
  { intent: "greeting", question: "Good afternoon" },
  { intent: "greeting", question: "Good evening" },
  { intent: "greeting", question: "What's up?" },
  { intent: "greeting", question: "Greetings" },
  { intent: "greeting", question: "Yo" },
  { intent: "greeting", question: "How are you?" },
];

// ─────────────────────────────────────────────
// Static knowledge base sections
// ─────────────────────────────────────────────

export const KB = {
  identity: `Auric Ledger is an Indian metal price tracking platform.
Website: https://auric-ledger.vercel.app
Telegram Bot: @AuricLedgerBot (https://t.me/AuricLedgerBot)
AI Assistant: Auric AI
Developer: Sabithulla
Contact: auricledger@gmail.com
Version: 1.1.0, launched February 15, 2026.
Prices updated daily at 9:00 AM IST in Indian Rupees (₹).
© 2026 Auric Ledger. All rights reserved.`,

  metals: `Auric Ledger tracks 9 metals:
1. Gold (XAU) — 3 purities: 24K (pure), 22K (most popular in India), 18K. Units: per gram, per 8 grams.
2. Silver (XAG) — per gram, per kilogram.
3. Platinum (XPT) — per gram, per kilogram.
4. Palladium (XPD) — per gram, per kilogram.
5. Copper (XCU) — per gram, per kilogram.
6. Lead (LEAD) — per gram, per kilogram.
7. Nickel (NI) — per gram, per kilogram.
8. Zinc (ZNC) — per gram, per kilogram.
9. Aluminium (ALU) — per gram, per kilogram.`,

  gold_purity: `Gold purity explained:
24K = 99.9% pure gold (most expensive, used for coins/bars/investment)
22K = 91.6% pure gold (most common for Indian jewellery)
18K = 75.0% pure gold (designer/international jewellery)
Higher carat = more pure = more expensive per gram.
In India, 22K is the standard for jewellery.`,

  price_formula: `How prices are calculated:
International price (USD per troy ounce) ÷ 31.1035 grams × USD-to-INR rate × 1.06 (6% import duty) × 1.03 (3% GST).
For Gold, purity multiplier applied: 24K=1.0, 22K=0.916, 18K=0.75.
Source: apised.com (metal prices), frankfurter.app (exchange rate). Updated daily at 9 AM IST.`,

  website_features: `Website features (https://auric-ledger.vercel.app):
- Live prices for 9 metals with daily change %
- Gold purity selector (18K, 22K, 24K) and unit selector
- 7-day and monthly interactive price charts
- Download CSV or PDF reports
- Set price threshold alerts (above/below) with email + browser notifications
- Subscribe to free daily email updates
- AI daily market summary auto-generated each morning
- Auric AI chatbot — ask questions about metals and prices
- Browser notifications for daily gold price
- Dark/Light mode, search metals, live ticker
- PWA — installable on phone home screen`,

  telegram: `Telegram Bot: @AuricLedgerBot
Commands:
/start — Welcome + all commands
/prices — Latest prices for all 9 metals
/yesterday — Yesterday's prices
/summary — AI daily market summary
/chart — Request price charts (e.g. XAU 7, XAG 30)
/download — Download CSV data for any metal
/ask <question> — Ask Auric AI anything about metals
/subscribe — Daily 9 AM IST price updates
/unsubscribe — Stop updates`,

  alerts_email: `Price Alerts: Two types:
1. Price Threshold — set a price limit, get alerted when the price crosses above or below that threshold.
2. % Change — triggers when daily change exceeds your set percentage.
Delivered via browser notification + email. 60-min cooldown between triggers.

Email: Free subscription on website.
Welcome email within 5 min, daily email at 9 AM IST, alert emails on trigger.`,

  capabilities: `Auric AI can help with:
- Current prices, specific date prices, yesterday's prices
- Date ranges, last N days, weekly/monthly trends
- Compare metals, rank cheapest/most expensive
- All gold carats, average prices
- Daily AI market summaries
- Info about Auric Ledger, features, Telegram bot
Cannot: give investment advice, predict prices, do crypto, non-metal topics.`,
};

// ─────────────────────────────────────────────
// Get relevant KB section for a given intent + question
// ─────────────────────────────────────────────

export const getRelevantKB = (intent, question) => {
  const q = question.toLowerCase();

  if (intent === "greeting") {
    return KB.identity + "\n\n" + KB.capabilities;
  }

  if (intent === "knowledge_query") {
    const parts = [];
    if (/who|creat|built|develop|about|what is|version|launch|contact/.test(q)) parts.push(KB.identity);
    if (/telegram|bot|\/start|\/price|\/ask|\/summary/.test(q)) parts.push(KB.telegram);
    if (/feature|website|site|download|csv|pdf|chart|dark|pwa|install/.test(q)) parts.push(KB.website_features);
    if (/alert|notif|email|subscri/.test(q)) parts.push(KB.alerts_email);
    if (/metal|track|which|how many/.test(q)) parts.push(KB.metals);
    if (/carat|karat|purity|24k|22k|18k/.test(q)) parts.push(KB.gold_purity);
    if (/formula|calculat|how.*(price|cost)|source|where.*data|duty|gst|why.*change/.test(q)) parts.push(KB.price_formula);
    if (/can you|what can|capabilit|help|able/.test(q)) parts.push(KB.capabilities);
    if (parts.length === 0) parts.push(KB.identity, KB.capabilities);
    return parts.join("\n\n");
  }

  if (intent === "summary_query") return KB.capabilities;

  // Price / comparison / trend — no KB needed, context data is sufficient
  return "";
};

export default KB;
