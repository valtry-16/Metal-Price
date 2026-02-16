-- Migration: Add welcome_sent_at column to price_email_subscriptions
-- Purpose: Track when welcome emails have been sent to new subscribers
-- Added: Background cron job that sends welcome emails every 5 minutes

-- Add welcome_sent_at column (nullable timestamp)
-- NULL means welcome email hasn't been sent yet
-- Timestamp value means welcome email was sent at that time
ALTER TABLE price_email_subscriptions
ADD COLUMN welcome_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Set welcome_sent_at for existing subscribers (assume they already got welcome at 9 AM cron)
-- This prevents re-sending welcome emails to existing users
UPDATE price_email_subscriptions
SET welcome_sent_at = subscribed_at
WHERE welcome_sent_at IS NULL;

-- Optional: Create index for faster lookups of pending welcomes
CREATE INDEX idx_price_email_welcome_pending 
ON price_email_subscriptions(welcome_sent_at) 
WHERE welcome_sent_at IS NULL;
