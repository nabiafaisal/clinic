-- Adds a real date-of-birth column so patient ages can auto-update every
-- year instead of staying frozen at whatever they were on their first visit
-- (e.g. your dad's record: first visit 2011, age 35 then -> should read 50
-- now in 2026, not still "35").
--
-- Backend now stores `dob` for any patient entered/edited going forward
-- (via the Date of Birth field already on the New/Edit Patient forms) and
-- computes their live age from it on every read.
--
-- For patients already in the database, we don't have their real DOB — but
-- we know their age AT their first visit and the date of that first visit,
-- so we can derive an approximate DOB from that (birth year is exact;
-- month/day is approximated from the first-visit date, which is accurate
-- enough for a correct age-in-years the vast majority of the time).

ALTER TABLE patients ADD COLUMN IF NOT EXISTS dob DATE;

UPDATE patients
SET dob = (date_of_first_visit - (CAST(regexp_replace(age, '[^0-9]', '', 'g') AS INT) || ' years')::interval)::date
WHERE dob IS NULL
  AND date_of_first_visit IS NOT NULL
  AND age ~ '[0-9]+'
  AND regexp_replace(age, '[^0-9]', '', 'g') <> '';
