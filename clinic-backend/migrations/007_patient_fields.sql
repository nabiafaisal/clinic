-- CNIC and Postal Address already existed on the Edit Patient screen and in
-- the database read/display code, but were never actually collectible on
-- New Patient and had no column to save into — so they silently vanished.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS cnic TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT;

-- New fields requested: main complaint, and a separate family history
-- (distinct from the existing general "history" field).
ALTER TABLE patients ADD COLUMN IF NOT EXISTS main_complaint TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS family_history TEXT;
