-- The "Reg No." field on Add/Edit User (for doctors) was never actually
-- saved because this column didn't exist yet.
ALTER TABLE users ADD COLUMN IF NOT EXISTS reg_no TEXT;
