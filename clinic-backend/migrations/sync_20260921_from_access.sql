-- One-time sync of the two new/changed records from mamu's latest Access
-- export, compared against the previous export.
--
-- 1) New patient, fileno 3387 "Alina Aqeel" (added skip-if-exists, in case
--    this same patient was already registered today through the web app —
--    since new patients now auto-continue the numbering at 3387 too).
-- 2) Name correction on fileno 6: "Noshaba Kanwal" -> "Noshaba Arshad".

INSERT INTO patients (legacy_fileno, name, fh_name, age, marital_status, mobile_no, date_of_first_visit, know_patient_of)
SELECT 3387, 'Alina Aqeel', 'Aqeel', '20', 'Unmarried', NULL, '2026-09-21', 'Egg allergy, Milk and dairy food allergy'
WHERE NOT EXISTS (SELECT 1 FROM patients WHERE legacy_fileno = 3387);

UPDATE patients
SET name = 'Noshaba Arshad'
WHERE legacy_fileno = 6 AND name = 'Noshaba Kanwal';
