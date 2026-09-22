-- 1) Make sure the new patient from mamu's Access file is in (safe to
--    re-run — does nothing if it's already there).
INSERT INTO patients (legacy_fileno, name, fh_name, age, marital_status, mobile_no, date_of_first_visit, know_patient_of)
SELECT 3387, 'Alina Aqeel', 'Aqeel', '20', 'Unmarried', NULL, '2026-09-21', 'Egg allergy, Milk and dairy food allergy'
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE legacy_fileno = 3387);

-- 2) Name correction on file #6 (safe to re-run).
UPDATE patients
SET name = 'Noshaba Arshad'
WHERE legacy_fileno = 6 AND name <> 'Noshaba Arshad';

-- 3) Placeholder records for the 19 file numbers that were never filled in
--    the original paper/Access records (confirmed missing in BOTH of
--    mamu's Access exports, not something lost in digitization). These
--    carry no invented patient data — they exist only so your numbering
--    runs continuously 1-3387, matching what mamu expects. `remarks`
--    flags them clearly so reception/doctor know not to treat them as
--    real records, in case the original paper file ever turns up.
INSERT INTO patients (legacy_fileno, name, remarks)
SELECT v.fileno,
       'Record Not Available',
       'Placeholder — this file number was blank/missing in the original records; no patient data exists for it.'
FROM (VALUES (15),(284),(348),(841),(966),(988),(1033),(1129),(1158),
             (1382),(1688),(1740),(1778),(1795),(1994),(2235),(2546),(2547),(2709)) AS v(fileno)
WHERE NOT EXISTS (SELECT 1 FROM patients p WHERE p.legacy_fileno = v.fileno);

-- 4) Verify — should now show 3387.
SELECT COUNT(*) AS total_patients, MAX(legacy_fileno) AS max_fileno FROM patients;
