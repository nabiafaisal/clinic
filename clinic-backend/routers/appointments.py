from fastapi import APIRouter, HTTPException, Security, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date
from db import get_conn
from auth_utils import get_current_user, require_role

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────

class AppointmentRequest(BaseModel):
    patient_name:      str
    mobile_no:          str
    cnic:               Optional[str] = None
    city:                Optional[str] = None
    preferred_date:      Optional[date] = None
    preferred_time:      Optional[str] = None
    appointment_mode:    Optional[str] = "physical"   # physical | video | audio | online
    reason:              Optional[str] = None

class AppointmentStatusUpdate(BaseModel):
    status: str   # completed | cancelled

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
def request_appointment(body: AppointmentRequest):
    """Public endpoint — no login required. A patient submits this from the booking page."""
    if not body.patient_name.strip() or not body.mobile_no.strip():
        raise HTTPException(status_code=400, detail="Name and mobile number are required")
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        INSERT INTO appointments
            (patient_name, mobile_no, cnic, city, preferred_date, preferred_time,
             appointment_mode, reason, status)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'pending')
        RETURNING *
    """, (
        body.patient_name.strip(), body.mobile_no.strip(), body.cnic, body.city,
        body.preferred_date, body.preferred_time, body.appointment_mode, body.reason
    ))
    row = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    return row

@router.get("/")
def list_appointments(
    status: Optional[str] = Query(None, description="pending | picked | completed | cancelled"),
    user=Security(require_role("superadmin", "admin", "doctor", "reception"))
):
    conn = get_conn()
    cur  = conn.cursor()
    if status:
        cur.execute("""
            SELECT a.*, u.name as picked_by_name
            FROM appointments a
            LEFT JOIN users u ON u.id = a.picked_by
            WHERE a.status = %s
            ORDER BY a.created_at DESC
        """, (status,))
    else:
        cur.execute("""
            SELECT a.*, u.name as picked_by_name
            FROM appointments a
            LEFT JOIN users u ON u.id = a.picked_by
            ORDER BY a.created_at DESC
        """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return rows

@router.post("/{appointment_id}/pick")
def pick_appointment(appointment_id: int, user=Security(require_role("superadmin", "doctor"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT status, picked_by FROM appointments WHERE id = %s", (appointment_id,))
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="Appointment not found")
    if row["status"] != "pending":
        cur.close(); conn.close()
        raise HTTPException(status_code=409, detail="This appointment has already been picked or resolved")
    cur.execute("""
        UPDATE appointments
        SET status = 'picked', picked_by = %s, picked_at = NOW()
        WHERE id = %s AND status = 'pending'
        RETURNING *
    """, (user["sub"], appointment_id))
    updated = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    if not updated:
        raise HTTPException(status_code=409, detail="This appointment has already been picked or resolved")
    return updated

@router.patch("/{appointment_id}/status")
def update_appointment_status(
    appointment_id: int,
    body: AppointmentStatusUpdate,
    user=Security(require_role("superadmin", "doctor"))
):
    if body.status not in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        UPDATE appointments SET status = %s WHERE id = %s RETURNING *
    """, (body.status, appointment_id))
    row = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return row
