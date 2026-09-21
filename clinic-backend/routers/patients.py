from fastapi import APIRouter, HTTPException, Security, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date
from db import get_conn
from auth_utils import get_current_user, require_role
import csv
import io
from fastapi.responses import StreamingResponse

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────

class PatientCreate(BaseModel):
    name:                str
    fh_name:             Optional[str] = None
    age:                 Optional[str] = None
    cnic:                Optional[str] = None
    marital_status:      Optional[str] = None
    mobile_no:           Optional[str] = None
    city:                Optional[str] = None
    country:             Optional[str] = None
    address:             Optional[str] = None
    patient_type:        Optional[str] = "in-clinic"
    consent_taken:       Optional[bool] = False
    date_of_first_visit: Optional[date] = None
    know_patient_of:     Optional[str] = None
    main_complaint:      Optional[str] = None
    history:             Optional[str] = None
    family_history:      Optional[str] = None
    temperament:         Optional[str] = None
    first_subscription:  Optional[str] = None
    latest_prescription: Optional[str] = None
    diagnosis:           Optional[str] = None
    remarks:             Optional[str] = None

class PatientUpdate(PatientCreate):
    name: Optional[str] = None

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
def list_patients(
    search: Optional[str] = Query(None),
    skip:   int = 0,
    limit:  int = 50,
    user=Security(get_current_user)
):
    conn = get_conn()
    cur  = conn.cursor()

    where = []
    params = []
    if search:
        where.append("""(
            name ILIKE %s OR mobile_no ILIKE %s OR fh_name ILIKE %s
            OR legacy_fileno ILIKE %s OR CAST(id AS TEXT) = %s
        )""")
        params += [f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", search.strip()]
    where_clause = ("WHERE " + " AND ".join(where)) if where else ""

    cur.execute(f"""
        SELECT id, legacy_fileno, name, fh_name, age, marital_status,
               mobile_no, city, patient_type, date_of_first_visit, diagnosis,
               created_at
        FROM patients
        {where_clause}
        ORDER BY id DESC LIMIT %s OFFSET %s
    """, params + [limit, skip])
    rows = cur.fetchall()

    cur.execute(f"SELECT COUNT(*) as total FROM patients {where_clause}", params)
    total = cur.fetchone()["total"]
    cur.close()
    conn.close()
    return {"total": total, "patients": rows}

# ── Export (must be before /{patient_id}) ─────────────────────────────────────

@router.get("/export")
def export_patients(user=Security(require_role("superadmin", "admin", "reception"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        SELECT legacy_fileno, name, fh_name, age, marital_status,
               mobile_no, city, country, patient_type,
               date_of_first_visit, diagnosis, remarks
        FROM patients
        ORDER BY legacy_fileno NULLS LAST, id
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['File#','Name','F/H Name','Age','Marital Status',
                     'Mobile','City','Country','Type','First Visit','Diagnosis','Remarks'])
    for r in rows:
        writer.writerow([r['legacy_fileno'], r['name'], r['fh_name'], r['age'],
                         r['marital_status'], r['mobile_no'], r['city'], r['country'],
                         r['patient_type'], r['date_of_first_visit'], r['diagnosis'], r['remarks']])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename="patients_export.csv"'}
    )

# ── Single patient (after /export) ───────────────────────────────────────────

@router.get("/{patient_id}")
def get_patient(patient_id: int, user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM patients WHERE id = %s", (patient_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")
    return row

@router.post("/", status_code=201)
def create_patient(body: PatientCreate, user=Security(require_role("superadmin", "admin", "reception", "doctor"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        INSERT INTO patients
            (name, fh_name, age, cnic, marital_status, mobile_no, city, country, address,
             patient_type, consent_taken, consent_datetime,
             date_of_first_visit, know_patient_of, main_complaint, history, family_history,
             temperament, first_subscription, latest_prescription, diagnosis, remarks, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING *
    """, (
        body.name, body.fh_name, body.age, body.cnic, body.marital_status, body.mobile_no,
        body.city, body.country, body.address, body.patient_type, body.consent_taken,
        "NOW()" if body.consent_taken else None,
        body.date_of_first_visit, body.know_patient_of, body.main_complaint, body.history,
        body.family_history, body.temperament, body.first_subscription, body.latest_prescription,
        body.diagnosis, body.remarks, user["sub"]
    ))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row

@router.patch("/{patient_id}")
def update_patient(patient_id: int, body: PatientUpdate, user=Security(require_role("superadmin", "admin", "reception", "doctor"))):
    conn = get_conn()
    cur  = conn.cursor()
    fields = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    set_clause += ", updated_by = %s, updated_at = NOW()"
    values = list(fields.values()) + [user["sub"], patient_id]
    cur.execute(f"UPDATE patients SET {set_clause} WHERE id = %s RETURNING *", values)
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")
    return row

@router.delete("/{patient_id}")
def delete_patient(patient_id: int, user=Security(require_role("superadmin"))):
    """Permanently deletes a patient AND all of their visit history/uploads.
    This cannot be undone — the frontend confirms with the user before
    calling this."""
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id FROM patients WHERE id = %s", (patient_id,))
    if not cur.fetchone():
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="Patient not found")

    cur.execute("SELECT id, file_url FROM visit_uploads WHERE visit_id IN (SELECT id FROM visits WHERE patient_id = %s)", (patient_id,))
    uploads = cur.fetchall()

    cur.execute("DELETE FROM visit_uploads WHERE visit_id IN (SELECT id FROM visits WHERE patient_id = %s)", (patient_id,))
    cur.execute("DELETE FROM visits WHERE patient_id = %s", (patient_id,))
    cur.execute("DELETE FROM patients WHERE id = %s", (patient_id,))
    conn.commit()
    cur.close()
    conn.close()

    # Best-effort cleanup of uploaded files on disk (not critical if it fails)
    import os
    for u in uploads:
        try:
            path = u["file_url"].lstrip("/")
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass

    return {"message": "Patient and all their visit history permanently deleted"}

@router.get("/{patient_id}/visits")
def get_patient_visits(patient_id: int, user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        SELECT * FROM visits
        WHERE patient_id = %s AND is_deleted = FALSE
        ORDER BY visit_date DESC
    """, (patient_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows
