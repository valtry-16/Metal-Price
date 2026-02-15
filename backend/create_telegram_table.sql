-- Create telegram_subscribers table
CREATE TABLE IF NOT EXISTS telegram_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id BIGINT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on chat_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_chat_id ON telegram_subscribers(chat_id);

-- Create index on active status for faster filtering
CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_active ON telegram_subscribers(active);
