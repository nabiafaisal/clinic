from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel
from db import get_conn
from auth_utils import get_current_user, require_role

router = APIRouter()

class RoleUpdate(BaseModel):
    role: str  # doctor | reception | dispenser

@router.get("/me")
def get_me(user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id, email, name, role, created_at FROM users WHERE id = %s", (user["sub"],))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row

@router.get("/")
def list_users(user=Security(require_role("doctor"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

@router.patch("/{user_id}/role")
def update_role(user_id: int, body: RoleUpdate, user=Security(require_role("doctor"))):
    if body.role not in ("doctor", "reception", "dispenser"):
        raise HTTPException(status_code=400, detail="Invalid role")
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("UPDATE users SET role = %s WHERE id = %s RETURNING id, email, role", (body.role, user_id))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row

@router.patch("/{user_id}/deactivate")
def deactivate_user(user_id: int, user=Security(require_role("doctor"))):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("UPDATE users SET is_active = FALSE WHERE id = %s RETURNING id, email", (user_id,))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deactivated", "user": row}
