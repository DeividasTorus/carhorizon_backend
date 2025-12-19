-- Migration: Add expo_push_token column to cars table for push notifications

ALTER TABLE cars ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR(255) DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cars_expo_push_token ON cars(expo_push_token) WHERE expo_push_token IS NOT NULL;
