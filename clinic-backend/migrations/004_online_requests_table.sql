-- A separate table for people who fill in the public "book an online
-- consultation" form. Deliberately NOT the patients table — this is just a
-- request. If the doctor decides to go ahead (after the Google Meet call),
-- staff add the person as a real patient themselves, normally.

CREATE TABLE IF NOT EXISTS online_requests (
    id               SERIAL PRIMARY KEY,
    name             TEXT NOT NULL,
    fh_name          TEXT,
    dob              DATE,
    age              TEXT,
    marital_status   TEXT,
    mobile_no        TEXT,
    city             TEXT,
    country          TEXT,
    google_email     TEXT,
    requested_date   DATE,
    requested_time   TEXT,
    problem_summary  TEXT,
    status           TEXT DEFAULT 'pending',   -- pending | reviewed
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
