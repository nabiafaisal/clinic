import os
import uuid
import shutil
from fastapi import APIRouter, HTTPException, Security, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from db import get_conn
from auth_utils import get_current_user, require_role

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Schemas ───────────────────────────────────────────────────────────────────

class VisitCreate(BaseModel):
    patient_id:              int
    visit_date:              Optional[date] = None
    visit_mode:              Optional[str] = "physical"
    case_type:               Optional[str] = None
    outcome:                 Optional[str] = None
    next_followup_date:      Optional[date] = None
    symptoms:                Optional[str] = None
    physiology:              Optional[str] = None
    pathology:               Optional[str] = None
    sub_subscription:        Optional[str] = None
    main_remedy:             Optional[str] = None
    medicine_duration:       Optional[str] = None
    bill_charges:            Optional[int] = 0
    consultation_charge:     Optional[int] = 0
    medicine_charge:         Optional[int] = 0
    finding_notes:           Optional[str] = None
    delivery_required:       Optional[bool] = False
    delivery_status:         Optional[str] = None
    doctor_name:             Optional[str] = None
    doctor_reg_no:           Optional[str] = None
    consultation_datetime:   Optional[datetime] = None
    telemedicine_consent:    Optional[bool] = False

class VisitUpdate(BaseModel):
    visit_date:              Optional[date] = None
    visit_mode:              Optional[str] = None
    case_type:               Optional[str] = None
    outcome:                 Optional[str] = None
    next_followup_date:      Optional[date] = None
    symptoms:                Optional[str] = None
    physiology:              Optional[str] = None
    pathology:               Optional[str] = None
    sub_subscription:        Optional[str] = None
    main_remedy:             Optional[str] = None
    medicine_duration:       Optional[str] = None
    bill_charges:            Optional[int] = None
    consultation_charge:     Optional[int] = None
    medicine_charge:         Optional[int] = None
    finding_notes:           Optional[str] = None
    delivery_required:       Optional[bool] = None
    delivery_status:         Optional[str] = None
    doctor_name:             Optional[str] = None
    doctor_reg_no:           Optional[str] = None
    consultation_datetime:   Optional[datetime] = None
    telemedicine_consent:    Optional[bool] = None

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
def list_visits(
    date_from: Optional[date] = None,
    date_to:   Optional[date] = None,
    skip:      int = 0,
    limit:     int = 50,
    user=Security(get_current_user)
):
    conn = get_conn()
    cur  = conn.cursor()
    where = ["v.is_deleted = FALSE"]
    params = []
    if date_from:
        where.append("v.visit_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("v.visit_date <= %s")
        params.append(date_to)
    where_clause = " AND ".join(where)
    params += [limit, skip]
    cur.execute(f"""
        SELECT v.*, p.name as patient_name, p.mobile_no
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
        WHERE {where_clause}
        ORDER BY v.visit_date DESC, v.id DESC
        LIMIT %s OFFSET %s
    """, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

@router.get("/diary-summary")
def diary_summary(user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        SELECT
            EXTRACT(YEAR  FROM visit_date)::int AS year,
            EXTRACT(MONTH FROM visit_date)::int AS month,
            COUNT(*) AS total
        FROM visits
        WHERE is_deleted = FALSE AND visit_date IS NOT NULL
        GROUP BY year, month
        ORDER BY year, month
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

@router.get("/{visit_id}")
def get_visit(visit_id: int, user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        SELECT v.*, p.name as patient_name, p.mobile_no, p.fh_name
        FROM visits v JOIN patients p ON p.id = v.patient_id
        WHERE v.id = %s AND v.is_deleted = FALSE
    """, (visit_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Visit not found")
    return row

@router.post("/", status_code=201)
def create_visit(body: VisitCreate, user=Security(require_role("doctor", "reception"))):
    conn = get_conn()
    cur  = conn.cursor()
    tele_consent_dt = "NOW()" if body.telemedicine_consent else None
    cur.execute("""
        INSERT INTO visits
            (patient_id, visit_date, visit_mode, case_type, outcome, next_followup_date,
             symptoms, physiology, pathology, sub_subscription, main_remedy, medicine_duration,
             bill_charges, consultation_charge, medicine_charge, finding_notes,
             delivery_required, delivery_status,
             doctor_name, doctor_reg_no, consultation_datetime,
             telemedicine_consent, telemedicine_consent_at,
             status, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'draft',%s)
        RETURNING *
    """, (
        body.patient_id, body.visit_date, body.visit_mode, body.case_type,
        body.outcome, body.next_followup_date, body.symptoms, body.physiology,
        body.pathology, body.sub_subscription, body.main_remedy, body.medicine_duration,
        body.bill_charges, body.consultation_charge, body.medicine_charge,
        body.finding_notes, body.delivery_required, body.delivery_status,
        body.doctor_name, body.doctor_reg_no, body.consultation_datetime,
        body.telemedicine_consent, tele_consent_dt, user["sub"]
    ))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row

@router.patch("/{visit_id}")
def update_visit(visit_id: int, body: VisitUpdate, user=Security(require_role("doctor", "reception"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT status FROM visits WHERE id = %s AND is_deleted = FALSE", (visit_id,))
    visit = cur.fetchone()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    if visit["status"] == "finalized" and user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Finalized visits can only be edited by doctors")
    fields = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    set_clause += ", updated_by = %s, updated_at = NOW()"
    values = list(fields.values()) + [user["sub"], visit_id]
    cur.execute(f"UPDATE visits SET {set_clause} WHERE id = %s RETURNING *", values)
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row

@router.post("/{visit_id}/finalize")
def finalize_visit(visit_id: int, user=Security(require_role("doctor"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        UPDATE visits SET status = 'finalized', updated_by = %s, updated_at = NOW()
        WHERE id = %s AND is_deleted = FALSE
        RETURNING *
    """, (user["sub"], visit_id))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Visit not found")
    return row

@router.delete("/{visit_id}")
def soft_delete_visit(visit_id: int, user=Security(require_role("doctor"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        UPDATE visits SET is_deleted = TRUE, updated_by = %s, updated_at = NOW()
        WHERE id = %s RETURNING id
    """, (user["sub"], visit_id))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Visit not found")
    return {"message": "Visit deleted (soft)"}

@router.patch("/{visit_id}/delivery")
def update_delivery(
    visit_id: int,
    status: str = Query(..., description="pending | dispatched | delivered"),
    user=Security(require_role("doctor", "dispenser"))
):
    if status not in ("pending", "dispatched", "delivered"):
        raise HTTPException(status_code=400, detail="Invalid delivery status")
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        UPDATE visits SET delivery_status = %s, updated_by = %s, updated_at = NOW()
        WHERE id = %s AND is_deleted = FALSE RETURNING id, delivery_status
    """, (status, user["sub"], visit_id))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Visit not found")
    return row

# ── File uploads ──────────────────────────────────────────────────────────────

@router.post("/{visit_id}/upload", status_code=201)
async def upload_file(
    visit_id: int,
    file: UploadFile = File(...),
    user=Security(require_role("doctor", "reception"))
):
    # Validate file type
    allowed_types = {"application/pdf", "image/jpeg", "image/png", "image/jpg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and images allowed")

    # Check visit exists
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id FROM visits WHERE id = %s AND is_deleted = FALSE", (visit_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Visit not found")

    # Save file with unique name
    ext      = os.path.splitext(file.filename)[1].lower()
    filename = f"{visit_id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Determine file type
    file_type = "pdf" if file.content_type == "application/pdf" else "image"
    file_url  = f"/uploads/{filename}"

    cur.execute("""
        INSERT INTO visit_uploads (visit_id, file_url, file_type, uploaded_by)
        VALUES (%s, %s, %s, %s) RETURNING *
    """, (visit_id, file_url, file_type, user["sub"]))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row

@router.get("/{visit_id}/uploads")
def get_uploads(visit_id: int, user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT * FROM visit_uploads WHERE visit_id = %s ORDER BY uploaded_at", (visit_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

@router.delete("/uploads/{upload_id}")
def delete_upload(upload_id: int, user=Security(require_role("doctor", "reception"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT file_url FROM visit_uploads WHERE id = %s", (upload_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Upload not found")
    # Delete file from disk
    filepath = row["file_url"].lstrip("/")
    if os.path.exists(filepath):
        os.remove(filepath)
    cur.execute("DELETE FROM visit_uploads WHERE id = %s", (upload_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Deleted"}