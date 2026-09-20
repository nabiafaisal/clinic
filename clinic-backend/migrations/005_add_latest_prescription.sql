-- New Patient form now has both "First Prescription" (already existed as
-- first_subscription) and a separate "Latest Prescription" field.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS latest_prescription TEXT;
