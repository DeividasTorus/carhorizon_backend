-- Migration: Make title nullable and ensure description is TEXT
-- This allows new posts to be created without title while keeping old posts intact

-- Make title nullable for new posts (existing posts keep their titles)
ALTER TABLE posts ALTER COLUMN title DROP NOT NULL;
ALTER TABLE posts ALTER COLUMN title SET DEFAULT NULL;

-- Ensure description is TEXT type (unlimited length)
ALTER TABLE posts ALTER COLUMN description TYPE TEXT;
