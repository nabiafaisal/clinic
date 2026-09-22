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
SET dob = (date_of_first_visit - (sub.age_years || ' years')::interval)::date
FROM (
    SELECT id,
           -- take only the FIRST run of digits in the age text (avoids
           -- garbled/garbage entries combining into an absurd number)
           CAST(substring(age FROM '[0-9]+') AS INT) AS age_years
    FROM patients
    WHERE age ~ '[0-9]+'
) sub
WHERE patients.id = sub.id
  AND patients.dob IS NULL
  AND patients.date_of_first_visit IS NOT NULL
  AND sub.age_years BETWEEN 0 AND 120;  -- sanity bound, skips garbage rows
