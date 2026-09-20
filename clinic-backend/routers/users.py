from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel
from typing import Optional
from db import get_conn
from auth_utils import get_current_user, require_role

router = APIRouter()

class RoleUpdate(BaseModel):
    role: str

class UserCreate(BaseModel):
    email:   str
    name:    str
    role:    str
    phone:   Optional[str] = None
    reg_no:  Optional[str] = None

class UserEdit(BaseModel):
    name:    Optional[str] = None
    phone:   Optional[str] = None
    reg_no:  Optional[str] = None

@router.get("/me")
def get_me(user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id, email, name, role, phone, created_at FROM users WHERE id = %s", (user["sub"],))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row

@router.get("/doctors")
def list_doctors(user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id, name, reg_no FROM users WHERE role = 'doctor' AND is_active = TRUE ORDER BY name")
    rows = cur.fetchall()
    cur.close(); conn.close()
    return rows

@router.get("/")
def list_users(user=Security(require_role("superadmin"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id, email, name, role, phone, reg_no, is_active, created_at FROM users ORDER BY created_at")
    rows = cur.fetchall()
    cur.close(); conn.close()
    return rows

@router.post("/", status_code=201)
def create_user(body: UserCreate, user=Security(require_role("superadmin"))):
    if body.role not in ("superadmin", "admin", "reception", "doctor", "dispenser"):
        raise HTTPException(status_code=400, detail="Invalid role")
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(
        "INSERT INTO users (email, name, role, phone, reg_no) VALUES (%s, %s, %s, %s, %s) RETURNING id, email, role",
        (body.email, body.name, body.role, body.phone, body.reg_no)
    )
    row = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    return row

@router.patch("/{user_id}/role")
def update_role(user_id: int, body: RoleUpdate, user=Security(require_role("superadmin"))):
    if body.role not in ("superadmin", "admin", "reception", "doctor", "dispenser"):
        raise HTTPException(status_code=400, detail="Invalid role")
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("UPDATE users SET role = %s WHERE id = %s RETURNING id, email, role", (body.role, user_id))
    row = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row

@router.patch("/{user_id}/deactivate")
def deactivate_user(user_id: int, user=Security(require_role("superadmin"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("UPDATE users SET is_active = FALSE WHERE id = %s RETURNING id, email", (user_id,))
    row = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deactivated", "user": row}

@router.patch("/{user_id}/activate")
def activate_user(user_id: int, user=Security(require_role("superadmin"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("UPDATE users SET is_active = TRUE WHERE id = %s RETURNING id, email", (user_id,))
    row = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User activated", "user": row}

@router.patch("/{user_id}")
def edit_user(user_id: int, body: UserEdit, user=Security(require_role("superadmin"))):
    conn = get_conn()
    cur  = conn.cursor()
    fields = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [user_id]
    cur.execute(f"UPDATE users SET {set_clause} WHERE id = %s RETURNING id, email, name, role, phone, reg_no", values)
    row = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row

@router.delete("/{user_id}")
def delete_user(user_id: int, user=Security(require_role("superadmin"))):
    if int(user["sub"]) == user_id:
        raise HTTPException(status_code=400, detail="You cannot remove your own account")
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
    target = cur.fetchone()
    if not target:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    if target["role"] == "superadmin":
        cur.execute("SELECT COUNT(*) as c FROM users WHERE role = 'superadmin'")
        if cur.fetchone()["c"] <= 1:
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail="Cannot remove the last superadmin")
    cur.execute("""
        SELECT
            (SELECT COUNT(*) FROM patients WHERE created_by = %s OR updated_by = %s) +
            (SELECT COUNT(*) FROM visits   WHERE created_by = %s OR updated_by = %s) AS c
    """, (user_id, user_id, user_id, user_id))
    if cur.fetchone()["c"] > 0:
        cur.close(); conn.close()
        raise HTTPException(
            status_code=400,
            detail="This user has patient/visit records on file and can't be permanently removed (audit trail). Deactivate them instead."
        )
    cur.execute("DELETE FROM users WHERE id = %s RETURNING id", (user_id,))
    row = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    return {"message": "User removed"}
