from fastapi import APIRouter, HTTPException, Security, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date
from db import get_conn
from auth_utils import require_role

router = APIRouter()

# Kept completely separate from the `patients` table on purpose — this is a
# self-submitted request from someone who is not (yet) a clinic patient.
# A doctor reviews it and, if they proceed, adds the person as a proper
# patient themselves (after the actual consult on Google Meet).

class OnlineRequestCreate(BaseModel):
    name:             str
    fh_name:          Optional[str] = None
    dob:              Optional[date] = None
    age:              Optional[str] = None
    marital_status:   Optional[str] = None
    mobile_no:        Optional[str] = None
    city:             Optional[str] = None
    country:          Optional[str] = None
    google_email:     Optional[str] = None
    requested_date:   Optional[date] = None
    requested_time:   Optional[str] = None
    problem_summary:  Optional[str] = None

# ── Public: patient submits this themselves, no login needed ─────────────────

@router.post("/", status_code=201)
def create_online_request(body: OnlineRequestCreate):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        INSERT INTO online_requests
            (name, fh_name, dob, age, marital_status, mobile_no, city, country,
             google_email, requested_date, requested_time, problem_summary)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        RETURNING id, name
    """, (
        body.name, body.fh_name, body.dob, body.age, body.marital_status,
        body.mobile_no, body.city, body.country, body.google_email,
        body.requested_date, body.requested_time, body.problem_summary
    ))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Request received. The clinic will contact you shortly.", "id": row["id"]}

# ── Staff: view / action pending requests ─────────────────────────────────────

@router.get("/")
def list_online_requests(
    status: Optional[str] = Query(None),
    user=Security(require_role("superadmin", "admin", "reception", "doctor"))
):
    conn = get_conn()
    cur  = conn.cursor()
    where, params = [], []
    if status:
        where.append("status = %s")
        params.append(status)
    where_clause = ("WHERE " + " AND ".join(where)) if where else ""
    cur.execute(f"""
        SELECT * FROM online_requests
        {where_clause}
        ORDER BY created_at DESC
    """, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

@router.patch("/{request_id}/mark-reviewed")
def mark_reviewed(
    request_id: int,
    user=Security(require_role("superadmin", "admin", "reception", "doctor"))
):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(
        "UPDATE online_requests SET status = 'reviewed' WHERE id = %s RETURNING id",
        (request_id,)
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"message": "Marked reviewed"}
