// ═══════════════════════════════════════════════════════════════
// Auric Ledger — Vector Knowledge Base for Auric AI
// ═══════════════════════════════════════════════════════════════
// Each intent has multiple candidate questions for semantic
// matching via cosine similarity with embedding vectors.
// Embeddings are pre-computed at startup and cached in memory.
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// Intent candidate patterns (40-60+ per intent)
// Comprehensive coverage for robust semantic matching
// ─────────────────────────────────────────────

export const INTENT_CANDIDATES = [
  // ══════════════════════════════════════════
  // ── price_query (60 candidates) ──────────
  // ══════════════════════════════════════════

  // Gold — general
  { intent: "price_query", question: "What is today's gold price?" },
  { intent: "price_query", question: "Gold price today" },
  { intent: "price_query", question: "Gold rate today in India" },
  { intent: "price_query", question: "What is the current gold rate?" },
  { intent: "price_query", question: "Today gold ka rate kya hai?" },
  { intent: "price_query", question: "Aaj gold ka bhav kya hai?" },
  { intent: "price_query", question: "Sone ka bhav batao" },
  { intent: "price_query", question: "Aaj sona kitne ka hai?" },
  { intent: "price_query", question: "Gold price per gram today" },
  { intent: "price_query", question: "How much is gold per gram?" },
  { intent: "price_query", question: "Show me gold price" },
  { intent: "price_query", question: "Tell me today's gold rate" },
  { intent: "price_query", question: "What is 1 gram gold price?" },
  { intent: "price_query", question: "Price of gold per 8 grams" },
  { intent: "price_query", question: "Gold price 8 gram" },

  // Gold — specific carats
  { intent: "price_query", question: "24K gold price today" },
  { intent: "price_query", question: "22K gold rate per gram" },
  { intent: "price_query", question: "18 karat gold price" },
  { intent: "price_query", question: "What is 22 carat gold price today?" },
  { intent: "price_query", question: "24 karat sone ka rate" },
  { intent: "price_query", question: "How much 22K gold per gram?" },
  { intent: "price_query", question: "Pure gold price today" },

  // Gold — specific dates
  { intent: "price_query", question: "What was gold price on 22 February?" },
  { intent: "price_query", question: "Gold price yesterday" },
  { intent: "price_query", question: "Gold price on Monday" },
  { intent: "price_query", question: "What was gold rate last Friday?" },
  { intent: "price_query", question: "Show gold price for 15 March" },
  { intent: "price_query", question: "Gold price 2 days ago" },

  // Silver
  { intent: "price_query", question: "How much is silver right now?" },
  { intent: "price_query", question: "Silver price today" },
  { intent: "price_query", question: "Silver rate per gram" },
  { intent: "price_query", question: "Chandi ka bhav kya hai?" },
  { intent: "price_query", question: "Silver price per kg" },
  { intent: "price_query", question: "Silver price yesterday" },
  { intent: "price_query", question: "What is the current silver rate in India?" },

  // Platinum
  { intent: "price_query", question: "Current platinum price per gram" },
  { intent: "price_query", question: "Platinum price today" },
  { intent: "price_query", question: "How much is platinum?" },
  { intent: "price_query", question: "Platinum rate per gram in India" },

  // Palladium
  { intent: "price_query", question: "What is the latest price of palladium?" },
  { intent: "price_query", question: "Palladium rate today" },
  { intent: "price_query", question: "How much does palladium cost?" },

  // Base metals
  { intent: "price_query", question: "Tell me the copper price" },
  { intent: "price_query", question: "Copper rate today" },
  { intent: "price_query", question: "Price of zinc per gram" },
  { intent: "price_query", question: "How much does aluminium cost?" },
  { intent: "price_query", question: "Lead price today" },
  { intent: "price_query", question: "Nickel rate per gram" },
  { intent: "price_query", question: "Zinc price per kg" },
  { intent: "price_query", question: "Aluminium rate today" },
  { intent: "price_query", question: "Lead rate per kg" },
  { intent: "price_query", question: "Nickel price per kg today" },

  // All metals / general
  { intent: "price_query", question: "Show me today's metal prices" },
  { intent: "price_query", question: "What are all metal prices today?" },
  { intent: "price_query", question: "Show all prices" },
  { intent: "price_query", question: "All metal rates today" },
  { intent: "price_query", question: "List all current prices" },
  { intent: "price_query", question: "What are the latest rates for all metals?" },
  { intent: "price_query", question: "Aaj sabhi dhatu ka bhav batao" },
  { intent: "price_query", question: "Price list" },
  { intent: "price_query", question: "Rate list" },
  { intent: "price_query", question: "Metal prices" },

  // ══════════════════════════════════════════
  // ── trend_query (50 candidates) ──────────
  // ══════════════════════════════════════════

  // Gold trends
  { intent: "trend_query", question: "How did gold move this week?" },
  { intent: "trend_query", question: "Gold price trend last 7 days" },
  { intent: "trend_query", question: "What is the gold price trend?" },
  { intent: "trend_query", question: "Weekly gold movement" },
  { intent: "trend_query", question: "Is gold going up or down?" },
  { intent: "trend_query", question: "Gold trend today" },
  { intent: "trend_query", question: "Gold price history" },
  { intent: "trend_query", question: "How has gold performed this month?" },
  { intent: "trend_query", question: "Gold ka rate badh raha hai ya gir raha hai?" },
  { intent: "trend_query", question: "Gold price last 30 days" },
  { intent: "trend_query", question: "Show me gold price chart" },
  { intent: "trend_query", question: "Gold movement from last Monday" },
  { intent: "trend_query", question: "How much has gold increased this week?" },
  { intent: "trend_query", question: "Gold up or down?" },
  { intent: "trend_query", question: "Is gold rising?" },
  { intent: "trend_query", question: "Gold rate going up?" },
  { intent: "trend_query", question: "When was gold cheapest this week?" },
  { intent: "trend_query", question: "Highest gold price this week" },
  { intent: "trend_query", question: "Gold ka trend batao" },

  // Silver trends
  { intent: "trend_query", question: "Show me silver trend" },
  { intent: "trend_query", question: "Silver movement this week" },
  { intent: "trend_query", question: "Is silver getting cheaper?" },
  { intent: "trend_query", question: "Silver price last 7 days" },
  { intent: "trend_query", question: "Silver going up?" },
  { intent: "trend_query", question: "How has silver changed recently?" },
  { intent: "trend_query", question: "Silver trend this month" },
  { intent: "trend_query", question: "Chandi ka rate badh raha hai?" },

  // Platinum & Palladium trends
  { intent: "trend_query", question: "How has platinum performed recently?" },
  { intent: "trend_query", question: "Platinum trend this week" },
  { intent: "trend_query", question: "Palladium price movement" },
  { intent: "trend_query", question: "How has palladium changed over the last week?" },
  { intent: "trend_query", question: "Is platinum going up?" },

  // Base metal trends
  { intent: "trend_query", question: "Price history of copper this month" },
  { intent: "trend_query", question: "Copper trend last 7 days" },
  { intent: "trend_query", question: "Is zinc price increasing?" },
  { intent: "trend_query", question: "Nickel trend this week" },
  { intent: "trend_query", question: "Lead price movement" },
  { intent: "trend_query", question: "Aluminium rate trend" },

  // General trend
  { intent: "trend_query", question: "How did metals perform last week?" },
  { intent: "trend_query", question: "Market trend this week" },
  { intent: "trend_query", question: "Price changes over last 7 days" },
  { intent: "trend_query", question: "Show me price movement for all metals" },
  { intent: "trend_query", question: "Weekly price changes" },
  { intent: "trend_query", question: "How did prices change this week?" },
  { intent: "trend_query", question: "Are metal prices going up?" },
  { intent: "trend_query", question: "Metal market direction" },
  { intent: "trend_query", question: "Show trends" },
  { intent: "trend_query", question: "Price graph" },
  { intent: "trend_query", question: "Show chart" },
  { intent: "trend_query", question: "Price fluctuation" },
  { intent: "trend_query", question: "How volatile are metal prices?" },

  // ══════════════════════════════════════════
  // ── comparison_query (40 candidates) ─────
  // ══════════════════════════════════════════

  // Gold vs others
  { intent: "comparison_query", question: "Compare gold and silver prices" },
  { intent: "comparison_query", question: "Gold vs silver" },
  { intent: "comparison_query", question: "Gold vs platinum" },
  { intent: "comparison_query", question: "Gold versus platinum comparison" },
  { intent: "comparison_query", question: "How does gold compare to silver today?" },
  { intent: "comparison_query", question: "Difference between gold and palladium price" },
  { intent: "comparison_query", question: "Gold or silver which is better?" },
  { intent: "comparison_query", question: "Gold aur chandi mein kya fark hai?" },
  { intent: "comparison_query", question: "Is gold more expensive than platinum?" },
  { intent: "comparison_query", question: "Which is costlier gold or platinum?" },

  // Silver vs others
  { intent: "comparison_query", question: "Silver vs copper price difference" },
  { intent: "comparison_query", question: "Compare silver and platinum" },
  { intent: "comparison_query", question: "Silver vs palladium" },

  // General comparisons
  { intent: "comparison_query", question: "Compare all metal prices" },
  { intent: "comparison_query", question: "Rank metals by price" },
  { intent: "comparison_query", question: "Which metal is cheapest?" },
  { intent: "comparison_query", question: "Which metal is most expensive?" },
  { intent: "comparison_query", question: "List metals from cheapest to expensive" },
  { intent: "comparison_query", question: "Sort metals by price" },
  { intent: "comparison_query", question: "Which is more expensive gold or platinum?" },
  { intent: "comparison_query", question: "Sabse sasta dhatu kaun sa hai?" },
  { intent: "comparison_query", question: "Sabse mehenga dhatu?" },
  { intent: "comparison_query", question: "Metal price ranking" },
  { intent: "comparison_query", question: "Price comparison of all metals" },
  { intent: "comparison_query", question: "How do precious metals compare?" },
  { intent: "comparison_query", question: "Precious metals vs base metals" },
  { intent: "comparison_query", question: "Compare base metal prices" },

  // Carat comparisons
  { intent: "comparison_query", question: "24K vs 22K gold price" },
  { intent: "comparison_query", question: "Difference between 22K and 18K gold" },
  { intent: "comparison_query", question: "How much cheaper is 22K vs 24K?" },
  { intent: "comparison_query", question: "22K aur 24K mein kitna fark hai?" },
  { intent: "comparison_query", question: "Compare gold carats" },

  // Date comparisons
  { intent: "comparison_query", question: "Compare today and yesterday prices" },
  { intent: "comparison_query", question: "Gold today vs yesterday" },
  { intent: "comparison_query", question: "How much has gold changed from yesterday?" },
  { intent: "comparison_query", question: "Price difference today vs last week" },
  { intent: "comparison_query", question: "Which metal went up the most today?" },
  { intent: "comparison_query", question: "Which metal dropped the most?" },
  { intent: "comparison_query", question: "Biggest gainer today" },
  { intent: "comparison_query", question: "Biggest loser today" },
  { intent: "comparison_query", question: "Most volatile metal" },
  { intent: "comparison_query", question: "Which metal changed the least?" },

  // ══════════════════════════════════════════
  // ── knowledge_query (55 candidates) ──────
  // ══════════════════════════════════════════

  // Identity / About
  { intent: "knowledge_query", question: "What is Auric Ledger?" },
  { intent: "knowledge_query", question: "Who built this app?" },
  { intent: "knowledge_query", question: "Who is the developer?" },
  { intent: "knowledge_query", question: "Who created Auric Ledger?" },
  { intent: "knowledge_query", question: "Tell me about this website" },
  { intent: "knowledge_query", question: "What is this platform?" },
  { intent: "knowledge_query", question: "Auric Ledger kya hai?" },
  { intent: "knowledge_query", question: "Ye app kisne banaya?" },
  { intent: "knowledge_query", question: "When was Auric Ledger launched?" },
  { intent: "knowledge_query", question: "What version is this?" },
  { intent: "knowledge_query", question: "Contact information" },
  { intent: "knowledge_query", question: "How to contact you?" },

  // Features
  { intent: "knowledge_query", question: "What features does Auric Ledger have?" },
  { intent: "knowledge_query", question: "What can this website do?" },
  { intent: "knowledge_query", question: "Features of this app" },
  { intent: "knowledge_query", question: "Is there a dark mode?" },
  { intent: "knowledge_query", question: "Can I download data?" },
  { intent: "knowledge_query", question: "Can I get CSV reports?" },
  { intent: "knowledge_query", question: "Can I download PDF?" },
  { intent: "knowledge_query", question: "Does this have charts?" },
  { intent: "knowledge_query", question: "Is there a search feature?" },
  { intent: "knowledge_query", question: "Can I install this on my phone?" },
  { intent: "knowledge_query", question: "How to install the app?" },
  { intent: "knowledge_query", question: "Is this a PWA?" },
  { intent: "knowledge_query", question: "Does this work offline?" },
  { intent: "knowledge_query", question: "Ye app phone mein install ho sakta hai?" },

  // Price formula / calculation
  { intent: "knowledge_query", question: "How is the gold price calculated?" },
  { intent: "knowledge_query", question: "What is the price formula?" },
  { intent: "knowledge_query", question: "How do you calculate the final price?" },
  { intent: "knowledge_query", question: "Why does gold price change?" },
  { intent: "knowledge_query", question: "What affects metal prices?" },
  { intent: "knowledge_query", question: "How are prices decided?" },
  { intent: "knowledge_query", question: "Where do you get the prices from?" },
  { intent: "knowledge_query", question: "What is the data source?" },
  { intent: "knowledge_query", question: "How often are prices updated?" },
  { intent: "knowledge_query", question: "When do prices get updated?" },
  { intent: "knowledge_query", question: "Gold ka rate kaise calculate hota hai?" },
  { intent: "knowledge_query", question: "Import duty on gold" },
  { intent: "knowledge_query", question: "GST on gold" },

  // Metals info
  { intent: "knowledge_query", question: "What metals are tracked?" },
  { intent: "knowledge_query", question: "How many metals do you track?" },
  { intent: "knowledge_query", question: "Which metals are available?" },
  { intent: "knowledge_query", question: "List of metals" },
  { intent: "knowledge_query", question: "Kaun kaun se dhatu track hote hain?" },

  // Gold purity
  { intent: "knowledge_query", question: "What is 22K gold?" },
  { intent: "knowledge_query", question: "What is 24 karat gold?" },
  { intent: "knowledge_query", question: "Explain gold carat purity" },
  { intent: "knowledge_query", question: "Difference between 22K and 24K" },
  { intent: "knowledge_query", question: "What is the purest gold?" },
  { intent: "knowledge_query", question: "Which gold is best for jewellery?" },
  { intent: "knowledge_query", question: "22K ka matlab kya hai?" },
  { intent: "knowledge_query", question: "Sona kitne prakar ka hota hai?" },

  // Telegram
  { intent: "knowledge_query", question: "Tell me about the Telegram bot" },
  { intent: "knowledge_query", question: "How to use the Telegram bot?" },
  { intent: "knowledge_query", question: "What commands does the bot have?" },
  { intent: "knowledge_query", question: "Telegram bot ka link do" },
  { intent: "knowledge_query", question: "How to subscribe on Telegram?" },
  { intent: "knowledge_query", question: "What is @AuricLedgerBot?" },

  // Alerts & Email
  { intent: "knowledge_query", question: "How to set price alerts?" },
  { intent: "knowledge_query", question: "How to subscribe to email updates?" },
  { intent: "knowledge_query", question: "What notifications do you support?" },
  { intent: "knowledge_query", question: "How do alerts work?" },
  { intent: "knowledge_query", question: "Can I get email alerts?" },
  { intent: "knowledge_query", question: "Alert kaise set kare?" },
  { intent: "knowledge_query", question: "Email subscription kaise kare?" },
  { intent: "knowledge_query", question: "How to get daily price email?" },
  { intent: "knowledge_query", question: "Browser notification kaise aayega?" },

  // Capabilities
  { intent: "knowledge_query", question: "What can you do?" },
  { intent: "knowledge_query", question: "What are your capabilities?" },
  { intent: "knowledge_query", question: "How can you help me?" },
  { intent: "knowledge_query", question: "Tum kya kya kar sakte ho?" },
  { intent: "knowledge_query", question: "Can you predict gold prices?" },
  { intent: "knowledge_query", question: "Do you give investment advice?" },
  { intent: "knowledge_query", question: "Can you track crypto?" },
  { intent: "knowledge_query", question: "What topics can you answer?" },

  // ══════════════════════════════════════════
  // ── summary_query (35 candidates) ────────
  // ══════════════════════════════════════════

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
  { intent: "summary_query", question: "Market report" },
  { intent: "summary_query", question: "Morning market update" },
  { intent: "summary_query", question: "Aaj ka market summary dikhao" },
  { intent: "summary_query", question: "Market ka haal batao" },
  { intent: "summary_query", question: "Aaj dhatu market mein kya hua?" },
  { intent: "summary_query", question: "Give me the market recap" },
  { intent: "summary_query", question: "Summarize metal prices" },
  { intent: "summary_query", question: "Show me the AI analysis" },
  { intent: "summary_query", question: "What does the AI say about today?" },
  { intent: "summary_query", question: "Daily metal analysis" },
  { intent: "summary_query", question: "Today's report" },
  { intent: "summary_query", question: "Metal market outlook" },
  { intent: "summary_query", question: "How is the market doing today?" },
  { intent: "summary_query", question: "Any market news today?" },
  { intent: "summary_query", question: "Market highlights today" },
  { intent: "summary_query", question: "Key takeaways from today's prices" },
  { intent: "summary_query", question: "What are the highlights of today's metal market?" },
  { intent: "summary_query", question: "Quick market update" },
  { intent: "summary_query", question: "Summary please" },
  { intent: "summary_query", question: "Show summary" },
  { intent: "summary_query", question: "Market brief" },
  { intent: "summary_query", question: "Price summary" },
  { intent: "summary_query", question: "Metal market summary" },

  // ══════════════════════════════════════════
  // ── greeting (25 candidates) ─────────────
  // ══════════════════════════════════════════

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
  { intent: "greeting", question: "Hey" },
  { intent: "greeting", question: "Hii" },
  { intent: "greeting", question: "Hola" },
  { intent: "greeting", question: "Namaste" },
  { intent: "greeting", question: "Namaskar" },
  { intent: "greeting", question: "Kya haal hai?" },
  { intent: "greeting", question: "Sup" },
  { intent: "greeting", question: "Good night" },
  { intent: "greeting", question: "Thanks" },
  { intent: "greeting", question: "Thank you" },
  { intent: "greeting", question: "Bye" },
  { intent: "greeting", question: "Goodbye" },
  { intent: "greeting", question: "See you" },
  { intent: "greeting", question: "Ok thanks" },
  { intent: "greeting", question: "Dhanyavaad" },
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
