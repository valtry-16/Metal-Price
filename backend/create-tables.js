import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const sql = `
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  metal_name TEXT NOT NULL,
  carat TEXT,
  weight_grams NUMERIC(12,4) NOT NULL,
  buy_price_per_gram NUMERIC(12,2) NOT NULL,
  total_cost NUMERIC(14,2) NOT NULL,
  bought_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at TIMESTAMPTZ,
  sell_price_per_gram NUMERIC(12,2),
  sell_total NUMERIC(14,2),
  is_sold BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS portfolio_balances (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  balance NUMERIC(14,2) NOT NULL DEFAULT 1000000.00,
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 1000000.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user ON portfolio_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_active ON portfolio_holdings(user_id, is_sold);
CREATE INDEX IF NOT EXISTS idx_portfolio_balances_user ON portfolio_balances(user_id);
`;

// Try multiple Supabase SQL execution methods
async function createTables() {
  console.log("Attempting to create portfolio tables...");

  // Method 1: Try Supabase SQL API
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) {
      console.log("✅ Tables created via exec_sql RPC");
      return;
    }
    console.log("exec_sql RPC not available:", res.status);
  } catch (e) {
    console.log("exec_sql failed:", e.message);
  }

  // Method 2: Try pg endpoint
  try {
    const res = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (res.ok) {
      console.log("✅ Tables created via pg/query");
      return;
    }
    console.log("pg/query not available:", res.status, await res.text());
  } catch (e) {
    console.log("pg/query failed:", e.message);
  }

  console.log("\n⚠️ Could not auto-create tables. Please run this SQL in your Supabase SQL Editor:");
  console.log("─".repeat(60));
  console.log(sql);
  console.log("─".repeat(60));
}

createTables();
