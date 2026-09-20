-- Run this once against your Postgres database (same way as the earlier
-- migration — Render's "Connect" psql shell, or any Postgres client).

-- Flags a patient record as a pending online-consultation request that
-- staff haven't reviewed/actioned yet.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;

-- The public consultation-request form has no logged-in user, so
-- created_by must be allowed to be empty for those rows.
ALTER TABLE patients ALTER COLUMN created_by DROP NOT NULL;
