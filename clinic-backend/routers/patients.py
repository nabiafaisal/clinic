from fastapi import APIRouter, HTTPException, Security, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date
from db import get_conn
import os
import uuid
import shutil
from fastapi import UploadFile, File
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
    marital_status:      Optional[str] = None
    mobile_no:           Optional[str] = None
    city:                Optional[str] = None
    country:             Optional[str] = None
    patient_type:        Optional[str] = "in-clinic"
    consent_taken:       Optional[bool] = False
    date_of_first_visit: Optional[date] = None
    know_patient_of:     Optional[str] = None
    history:             Optional[str] = None
    temperament:         Optional[str] = None
    first_subscription:  Optional[str] = None
    diagnosis:           Optional[str] = None
    remarks:             Optional[str] = None

class PatientUpdate(PatientCreate):
    name: Optional[str] = None  # all fields optional for update

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
def list_patients(
    search: Optional[str] = Query(None, description="Search by name or mobile"),
    skip:   int = 0,
    limit:  int = 50,
    user=Security(get_current_user)
):
    conn = get_conn()
    cur  = conn.cursor()
    if search:
        q = f"%{search}%"
        cur.execute("""
            SELECT id, legacy_fileno, name, fh_name, age, marital_status,
                   mobile_no, city, patient_type, date_of_first_visit, diagnosis
            FROM patients
            WHERE name ILIKE %s OR mobile_no ILIKE %s OR fh_name ILIKE %s
            ORDER BY id DESC LIMIT %s OFFSET %s
        """, (q, q, q, limit, skip))
    else:
        cur.execute("""
            SELECT id, legacy_fileno, name, fh_name, age, marital_status,
                   mobile_no, city, patient_type, date_of_first_visit, diagnosis
            FROM patients
            ORDER BY id DESC LIMIT %s OFFSET %s
        """, (limit, skip))
    rows = cur.fetchall()

    cur.execute("SELECT COUNT(*) as total FROM patients" +
                (" WHERE name ILIKE %s OR mobile_no ILIKE %s OR fh_name ILIKE %s" if search else ""),
                (f"%{search}%", f"%{search}%", f"%{search}%") if search else ())
    total = cur.fetchone()["total"]
    cur.close()
    conn.close()
    return {"total": total, "patients": rows}

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
def create_patient(body: PatientCreate, user=Security(require_role("doctor", "reception"))):
    conn = get_conn()
    cur  = conn.cursor()

    consent_dt = "NOW()" if body.consent_taken else None

    cur.execute("""
        INSERT INTO patients
            (name, fh_name, age, marital_status, mobile_no, city, country,
             patient_type, consent_taken, consent_datetime,
             date_of_first_visit, know_patient_of, history, temperament,
             first_subscription, diagnosis, remarks, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING *
    """, (
        body.name, body.fh_name, body.age, body.marital_status, body.mobile_no,
        body.city, body.country, body.patient_type, body.consent_taken,
        "NOW()" if body.consent_taken else None,
        body.date_of_first_visit, body.know_patient_of, body.history,
        body.temperament, body.first_subscription, body.diagnosis,
        body.remarks, user["sub"]
    ))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row

@router.patch("/{patient_id}")
def update_patient(patient_id: int, body: PatientUpdate, user=Security(require_role("doctor", "reception"))):
    conn = get_conn()
    cur  = conn.cursor()

    # Only update fields that were actually sent
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
import csv, io
from fastapi.responses import StreamingResponse

@router.get("/export")
def export_patients(user=Security(get_current_user)):
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
@router.post("/{patient_id}/upload", status_code=201)
async def upload_patient_file(
    patient_id: int,
    file: UploadFile = File(...),
    user=Security(require_role("doctor", "reception"))
):
    allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/jpg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and images allowed")

    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id FROM patients WHERE id = %s", (patient_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Patient not found")

    os.makedirs("uploads", exist_ok=True)
    ext      = os.path.splitext(file.filename)[1].lower()
    filename = f"pat_{patient_id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join("uploads", filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_type = "pdf" if file.content_type == "application/pdf" else "image"
    file_url  = f"/uploads/{filename}"

    cur.execute("""
        INSERT INTO patient_uploads (patient_id, file_url, file_type, uploaded_by)
        VALUES (%s, %s, %s, %s) RETURNING *
    """, (patient_id, file_url, file_type, user["sub"]))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row


@router.get("/{patient_id}/uploads")
def get_patient_uploads(patient_id: int, user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM patient_uploads WHERE patient_id = %s ORDER BY uploaded_at", (patient_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


@router.delete("/uploads/{upload_id}")
def delete_patient_upload(upload_id: int, user=Security(require_role("doctor", "reception"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT file_url FROM patient_uploads WHERE id = %s", (upload_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Upload not found")
    filepath = row["file_url"].lstrip("/")
    if os.path.exists(filepath):
        os.remove(filepath)
    cur.execute("DELETE FROM patient_uploads WHERE id = %s", (upload_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Deleted"}