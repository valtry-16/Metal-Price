-- Create price_email_subscriptions table for daily email notifications
CREATE TABLE IF NOT EXISTS price_email_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_email ON price_email_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_subscribed_at ON price_email_subscriptions(subscribed_at);

-- Add comment to table
COMMENT ON TABLE price_email_subscriptions IS 'Stores email addresses for daily metal price notifications';
COMMENT ON COLUMN price_email_subscriptions.email IS 'User email address';
COMMENT ON COLUMN price_email_subscriptions.subscribed_at IS 'When the user subscribed to daily emails';
COMMENT ON COLUMN price_email_subscriptions.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN price_email_subscriptions.updated_at IS 'Record update timestamp';
