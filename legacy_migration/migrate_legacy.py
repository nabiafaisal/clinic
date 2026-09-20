"""
Import the legacy Access database (file.csv = patients, dairy.csv = visits)
into the new Postgres database for the clinic web app.

Usage:
    python3 migrate_legacy.py --dry-run                     # validate only, no DB writes
    python3 migrate_legacy.py --database-url "postgres://..." --imported-by 1

--imported-by should be the numeric `id` of the superadmin user in the NEW
database (created_by/updated_by columns need a valid user id). If omitted,
the script looks up the first superadmin it finds.
"""
import argparse
import csv
import sys
from datetime import datetime

FILE_CSV  = "file.csv"
DAIRY_CSV = "dairy.csv"


def parse_dt(raw):
    """Access exports dates as MM/DD/YY HH:MM:SS. Returns a date() or None."""
    raw = (raw or "").strip()
    if not raw:
        return None
    for fmt in ("%m/%d/%y %H:%M:%S", "%m/%d/%Y %H:%M:%S", "%m/%d/%y", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def clean(v):
    v = (v or "").strip()
    return v if v else None


def load_patients():
    with open(FILE_CSV, encoding="utf-8", errors="replace") as f:
        rows = list(csv.DictReader(f))

    patients = []
    empty_name_count = 0
    for r in rows:
        fileno = clean(r["fileno"])
        if not fileno:
            continue
        name = clean(r["name"])
        if not name:
            empty_name_count += 1
            name = f"Unnamed (File #{fileno})"
        patients.append({
            "legacy_fileno":        int(fileno),
            "name":                 name,
            "fh_name":              clean(r["nic"]),        # mislabeled in source: actually F/H name
            "age":                  clean(r["age"]),
            "marital_status":       clean(r["maritalstatus"]),
            "date_of_first_visit":  parse_dt(r["dateofvisit"]),
            "know_patient_of":      clean(r["knowpatientof"]),
            "history":              clean(r["history"]),
            "temperament":          clean(r["temperament"]),
            "first_subscription":   clean(r["firstsubscription"]),
            "diagnosis":            clean(r["diagnosis"]),
            "remarks":              clean(r["remarks"]),
            # mobileno is unusable — stored as a 32-bit int in the source and
            # overflowed for real 11-digit Pakistani numbers (almost all read back as 0).
            "mobile_no":            None,
        })
    return patients, empty_name_count


def load_visits(valid_filenos):
    with open(DAIRY_CSV, encoding="utf-8", errors="replace") as f:
        rows = list(csv.DictReader(f))

    visits = []
    orphans = 0
    for r in rows:
        fileno = clean(r["fileno"])
        if not fileno or int(fileno) not in valid_filenos:
            orphans += 1
            continue
        visits.append({
            "legacy_fileno":     int(fileno),
            "visit_date":        parse_dt(r["visitdate"]),
            "symptoms":          clean(r["symptoms"]),
            "physiology":        clean(r["physiology"]),
            "pathology":         clean(r["pathology"]),
            "sub_subscription":  clean(r["subsubscription"]),
            "main_remedy":       clean(r["mainremedy"]),
            "bill_charges":      int(r["billcharges"]) if clean(r["billcharges"]) else 0,
            "finding_notes":     clean(r["findingnote"]),
        })
    return visits, orphans


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url")
    ap.add_argument("--imported-by", type=int)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    patients, empty_names = load_patients()
    filenos = {p["legacy_fileno"] for p in patients}
    visits, orphan_visits = load_visits(filenos)

    print(f"Patients parsed:      {len(patients)}  ({empty_names} had a blank name, auto-labeled)")
    print(f"Visits parsed:        {len(visits)}  ({orphan_visits} skipped — no matching patient fileno)")
    print(f"Date range (visits):  {min((v['visit_date'] for v in visits if v['visit_date']), default='?')} "
          f"to {max((v['visit_date'] for v in visits if v['visit_date']), default='?')}")

    if args.dry_run or not args.database_url:
        print("\nDry run only — no database changes made. Re-run with --database-url to import.")
        return

    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(args.database_url, cursor_factory=psycopg2.extras.RealDictCursor)
    cur = conn.cursor()

    imported_by = args.imported_by
    if not imported_by:
        cur.execute("SELECT id FROM users WHERE role = 'superadmin' ORDER BY id LIMIT 1")
        row = cur.fetchone()
        if not row:
            print("No superadmin user found in the target database — log into the app once first, "
                  "or pass --imported-by <user_id> explicitly.")
            sys.exit(1)
        imported_by = row["id"]
        print(f"Using superadmin id={imported_by} for created_by/updated_by")

    fileno_to_id = {}
    inserted_patients = 0
    for p in patients:
        cur.execute("""
            INSERT INTO patients
                (legacy_fileno, name, fh_name, age, marital_status, mobile_no,
                 patient_type, date_of_first_visit, know_patient_of, history,
                 temperament, first_subscription, diagnosis, remarks, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,'in-clinic',%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
        """, (
            p["legacy_fileno"], p["name"], p["fh_name"], p["age"], p["marital_status"],
            p["mobile_no"], p["date_of_first_visit"], p["know_patient_of"], p["history"],
            p["temperament"], p["first_subscription"], p["diagnosis"], p["remarks"], imported_by
        ))
        new_id = cur.fetchone()["id"]
        fileno_to_id[p["legacy_fileno"]] = new_id
        inserted_patients += 1

    inserted_visits = 0
    for v in visits:
        patient_id = fileno_to_id.get(v["legacy_fileno"])
        if not patient_id:
            continue
        cur.execute("""
            INSERT INTO visits
                (patient_id, visit_date, visit_mode, case_type, symptoms, physiology,
                 pathology, sub_subscription, main_remedy, bill_charges, finding_notes,
                 status, created_by)
            VALUES (%s,%s,'physical','follow-up',%s,%s,%s,%s,%s,%s,%s,'finalized',%s)
        """, (
            patient_id, v["visit_date"], v["symptoms"], v["physiology"], v["pathology"],
            v["sub_subscription"], v["main_remedy"], v["bill_charges"], v["finding_notes"],
            imported_by
        ))
        inserted_visits += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nImported {inserted_patients} patients and {inserted_visits} visits.")


if __name__ == "__main__":
    main()
