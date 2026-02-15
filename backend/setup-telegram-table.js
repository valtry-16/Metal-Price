import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const createTelegramTable = async () => {
  console.log("Creating telegram_subscribers table...");
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS telegram_subscribers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        chat_id BIGINT UNIQUE NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_chat_id ON telegram_subscribers(chat_id);
      CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_active ON telegram_subscribers(active);
    `
  });
  
  if (error) {
    console.error("Error creating table:", error);
    
    // Try alternative method using REST API
    console.log("\nTrying alternative method...");
    console.log("\n⚠️  Please run this SQL in your Supabase SQL Editor:");
    console.log("=========================================");
    console.log(`
CREATE TABLE IF NOT EXISTS telegram_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id BIGINT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_chat_id ON telegram_subscribers(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_active ON telegram_subscribers(active);
    `);
    console.log("=========================================");
    console.log("\n1. Go to: https://supabase.com/dashboard/project/hapurhjslswrcgyndobj/sql/new");
    console.log("2. Paste the SQL above");
    console.log("3. Click 'Run'");
    return false;
  }
  
  console.log("✅ Table created successfully!");
  return true;
};

createTelegramTable();
