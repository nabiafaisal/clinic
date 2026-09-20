-- Run this once against your Postgres database (Render dashboard → your DB → Connect →
-- the SQL shell / psql, or any Postgres client such as TablePlus/pgAdmin using your
-- DATABASE_URL). Safe to run as one block.

-- 1. CNIC on patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS cnic VARCHAR(15);

-- 2. Doctor registration number on users (for the doctor dropdown / Manage Users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS reg_no VARCHAR(50);

-- 3. Appointment requests (public booking + doctor/superadmin pick queue)
CREATE TABLE IF NOT EXISTS appointments (
    id                  SERIAL PRIMARY KEY,
    patient_name        VARCHAR(200) NOT NULL,
    mobile_no           VARCHAR(30)  NOT NULL,
    cnic                VARCHAR(15),
    city                VARCHAR(100),
    preferred_date      DATE,
    preferred_time      VARCHAR(50),
    appointment_mode    VARCHAR(20)  DEFAULT 'physical',   -- physical | video | audio | online
    reason              TEXT,
    status              VARCHAR(20)  DEFAULT 'pending',    -- pending | picked | completed | cancelled
    picked_by           INTEGER REFERENCES users(id),
    picked_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
