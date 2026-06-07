from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel
from typing import Optional
from db import get_conn
from auth_utils import get_current_user, require_role

router = APIRouter()

class RoleUpdate(BaseModel):
    role: str

class UserCreate(BaseModel):
    email:  str
    name:   str
    role:   str
    phone:  Optional[str] = None

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

@router.get("/")
def list_users(user=Security(require_role("superadmin"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id, email, name, role, phone, is_active, created_at FROM users ORDER BY created_at")
    rows = cur.fetchall()
    cur.close(); conn.close()
    return rows

@router.post("/", status_code=201)
def create_user(body: UserCreate, user=Security(require_role("superadmin"))):
    if body.role not in ("superadmin", "admin", "reception"):
        raise HTTPException(status_code=400, detail="Invalid role")
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(
        "INSERT INTO users (email, name, role, phone) VALUES (%s, %s, %s, %s) RETURNING id, email, role",
        (body.email, body.name, body.role, body.phone)
    )
    row = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()
    return row

@router.patch("/{user_id}/role")
def update_role(user_id: int, body: RoleUpdate, user=Security(require_role("superadmin"))):
    if body.role not in ("superadmin", "admin", "reception"):
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
