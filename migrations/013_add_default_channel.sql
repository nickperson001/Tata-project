-- Add default_channel column to products table (missing from earlier migration)
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_channel text NOT NULL DEFAULT '';
