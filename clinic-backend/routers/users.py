from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel
from typing import Optional
import psycopg2
from db import get_conn
from auth_utils import (
    get_current_user, require_role,
    hash_password, generate_temp_password, send_password_reset_email,
)

router = APIRouter()

VALID_ROLES = ("superadmin", "admin", "reception", "doctor")

class RoleUpdate(BaseModel):
    role: str

class UserCreate(BaseModel):
    email:    str
    name:     str
    role:     str
    phone:    Optional[str] = None
    reg_no:   Optional[str] = None
    password: Optional[str] = None  # if omitted, a temp password is generated

class UserEdit(BaseModel):
    name:   Optional[str] = None
    email:  Optional[str] = None
    phone:  Optional[str] = None
    reg_no: Optional[str] = None

@router.get("/doctors")
def list_doctors(user=Security(get_current_user)):
    """Active doctors, for populating the doctor picker on the New Visit
    form. Any logged-in staff member can see this list (they need it to
    log a visit) — it's not a superadmin-only endpoint like GET /users/."""
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(
        "SELECT id, name, reg_no FROM users WHERE role = 'doctor' AND is_active = TRUE ORDER BY name"
    )
    rows = cur.fetchall()
    cur.close(); conn.close()
    return rows

@router.get("/me")
def get_me(user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id, email, name, role, phone, reg_no, created_at FROM users WHERE id = %s", (user["sub"],))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row

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
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    temp_password = body.password or generate_temp_password()

    conn = get_conn()
    cur  = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (email, name, role, phone, reg_no, password_hash) VALUES (%s, %s, %s, %s, %s, %s) "
            "RETURNING id, email, role",
            (body.email.strip().lower(), body.name, body.role, body.phone, body.reg_no, hash_password(temp_password))
        )
        row = cur.fetchone()
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        cur.close(); conn.close()
        raise HTTPException(status_code=409, detail="A user with this email already exists.")
    cur.close(); conn.close()

    emailed = send_password_reset_email(row["email"], temp_password, body.name)

    return {
        **row,
        "temp_password": temp_password,
        "emailed": emailed,
    }

@router.patch("/{user_id}")
def edit_user(user_id: int, body: UserEdit, user=Security(require_role("superadmin"))):
    """Edit an already-registered user's name/email/phone/reg_no. Role and
    active status have their own endpoints below."""
    fields = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "email" in fields:
        fields["email"] = fields["email"].strip().lower()

    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [user_id]

    conn = get_conn()
    cur  = conn.cursor()
    try:
        cur.execute(
            f"UPDATE users SET {set_clause} WHERE id = %s RETURNING id, email, name, role, phone, reg_no",
            values
        )
        row = cur.fetchone()
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        cur.close(); conn.close()
        raise HTTPException(status_code=409, detail="A user with this email already exists.")
    cur.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row

@router.patch("/{user_id}/reset-password")
def reset_password(user_id: int, user=Security(require_role("superadmin"))):
    """Superadmin-triggered reset for a user who forgot their password.
    Generates a new temp password, stores its hash, best-effort emails it,
    and always returns the plain value so the admin can relay it manually
    (e.g. over WhatsApp/call) if the email doesn't land."""
    new_password = generate_temp_password()

    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(
        "UPDATE users SET password_hash = %s WHERE id = %s RETURNING id, email, name",
        (hash_password(new_password), user_id)
    )
    row = cur.fetchone()
    conn.commit()
    cur.close(); conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    emailed = send_password_reset_email(row["email"], new_password, row["name"])

    return {
        "message": "Password reset.",
        "user": {"id": row["id"], "email": row["email"], "name": row["name"]},
        "new_password": new_password,
        "emailed": emailed,
    }

@router.patch("/{user_id}/role")
def update_role(user_id: int, body: RoleUpdate, user=Security(require_role("superadmin"))):
    if body.role not in VALID_ROLES:
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

@router.delete("/{user_id}")
def delete_user(user_id: int, user=Security(require_role("superadmin"))):
    """Permanently removes a user account. This did not exist before —
    the frontend's "Remove" button was calling an endpoint that was never
    built, which is why it silently did nothing."""
    if user_id == user["sub"]:
        raise HTTPException(status_code=400, detail="You can't remove your own account.")

    conn = get_conn()
    cur  = conn.cursor()
    try:
        cur.execute("DELETE FROM users WHERE id = %s RETURNING id, email", (user_id,))
        row = cur.fetchone()
        conn.commit()
    except psycopg2.errors.ForeignKeyViolation:
        conn.rollback()
        cur.close(); conn.close()
        raise HTTPException(
            status_code=409,
            detail="This user has created patient or visit records, so they can't be permanently removed. Deactivate them instead."
        )
    cur.close(); conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User removed", "user": row}
