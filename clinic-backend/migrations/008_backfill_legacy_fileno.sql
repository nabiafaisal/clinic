-- Backfills a proper, continuing file number for any patient that was created
-- (in the gap between the original 3368-patient import and today's fix)
-- without ever getting a legacy_fileno assigned. Those patients were falling
-- back to displaying their raw internal `id` (the ~16996-22000+ range),
-- which is what showed up as odd "5-digit" numbers.
--
-- This assigns them sequential numbers continuing from the current highest
-- legacy_fileno, in the order they were created (by internal id), so they
-- slot in right after your real patients (e.g. 3387, 3388, 3389...).
--
-- Safe to run once. Re-running is a no-op (nothing left with legacy_fileno IS NULL).

WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM patients
    WHERE legacy_fileno IS NULL
),
base AS (
    SELECT COALESCE(MAX(legacy_fileno), 0) AS start_no FROM patients
)
UPDATE patients p
SET legacy_fileno = base.start_no + numbered.rn
FROM numbered, base
WHERE p.id = numbered.id;
