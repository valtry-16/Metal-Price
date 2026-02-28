// ═══════════════════════════════════════════════════════════════
// Auric Ledger — Sectioned Knowledge Base for Auric AI
// ═══════════════════════════════════════════════════════════════
// Each section is a small, focused block. Only the relevant
// section(s) are injected into the prompt — never the whole KB.
// This keeps context small for the 0.5B model.
// ═══════════════════════════════════════════════════════════════

const KB = {
  identity: `Auric Ledger is an Indian metal price tracking platform.
Website: https://auric-ledger.vercel.app
Telegram Bot: @AuricLedgerBot (https://t.me/AuricLedgerBot)
AI Assistant: Auric AI
Developer: Sabithulla
Contact: auricledger@gmail.com
Version: 1.0.0, launched February 15, 2026.
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
- Set price alerts (target price or % change)
- Subscribe to free daily email updates
- Browser notifications for daily gold price
- Dark/Light mode, search metals, live ticker
- PWA — installable on phone home screen
- Auric AI chat widget`,

  telegram: `Telegram Bot: @AuricLedgerBot
/start or /help — All commands
/prices — Latest prices for all 9 metals
/yesterday — Yesterday's prices
/chart — Request price charts
/subscribe — Daily 9 AM IST updates
/unsubscribe — Stop updates
/ask <question> — Ask Auric AI
Quick charts: "XAU 7" (7-day), "XAG 30" (30-day)`,

  alerts_email: `Price Alerts: Two types:
1. Target Price — triggers when price reaches target (±1%)
2. % Change — triggers when daily change exceeds threshold
Delivered via browser notification + email. 60-min cooldown.

Email: Free subscription on website.
Welcome email within 5 min, daily email at 9 AM IST, alert emails on trigger.`,

  capabilities: `Auric AI can help with:
- Current prices, specific date prices, yesterday's prices
- Date ranges, last N days, weekly/monthly trends
- Compare metals, rank cheapest/most expensive
- All gold carats, average prices
- Info about Auric Ledger, features, Telegram bot
Cannot: give investment advice, predict prices, do crypto, non-metal topics.`,
};

/**
 * Look up relevant KB section(s) for the given intent + question.
 * Returns a short focused string — never the full KB.
 */
export const getRelevantKB = (intent, question) => {
  const q = question.toLowerCase();

  if (intent === "greeting") {
    return KB.identity + "\n\n" + KB.capabilities;
  }

  if (intent === "site_info") {
    const parts = [];
    if (/who|creat|built|develop|about|what is|version|launch|contact/.test(q)) parts.push(KB.identity);
    if (/telegram|bot|\/start|\/price|\/ask/.test(q)) parts.push(KB.telegram);
    if (/feature|website|site|download|csv|pdf|chart|dark|pwa|install/.test(q)) parts.push(KB.website_features);
    if (/alert|notif|email|subscri/.test(q)) parts.push(KB.alerts_email);
    if (/metal|track|which|how many/.test(q)) parts.push(KB.metals);
    if (/carat|karat|purity|24k|22k|18k/.test(q)) parts.push(KB.gold_purity);
    if (/formula|calculat|how.*(price|cost)|source|where.*data|duty|gst/.test(q)) parts.push(KB.price_formula);
    if (/can you|what can|capabilit|help|able/.test(q)) parts.push(KB.capabilities);
    if (parts.length === 0) parts.push(KB.identity, KB.capabilities);
    return parts.join("\n\n");
  }

  if (intent === "help") return KB.capabilities;
  if (intent === "carats") return KB.gold_purity;

  // Price / compare / trend / rank / average — no KB needed, context data is sufficient
  return "";
};

export default KB;
