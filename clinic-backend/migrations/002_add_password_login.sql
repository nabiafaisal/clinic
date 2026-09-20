-- Run this once against your Postgres database (e.g. via Render's "Connect"
-- psql shell, or any Postgres client pointed at your DATABASE_URL) to add
-- password-based login support.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Optional: set an initial password for your superadmin account so you can
-- log in immediately. Replace the bcrypt hash below with one you generate
-- yourself (see instructions), or just use the app's "create user" /
-- "reset password" endpoints once one admin can log in.
--
-- To generate a bcrypt hash locally:
--   python3 -c "import bcrypt; print(bcrypt.hashpw(b'YOUR_TEMP_PASSWORD', bcrypt.gensalt()).decode())"
--
-- UPDATE users SET password_hash = '<paste bcrypt hash here>'
--   WHERE email = 'almoalijhomoeo@gmail.com';
