from fastapi import APIRouter, HTTPException, Security
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from db import get_conn
from auth_utils import (
    verify_google_token, create_jwt,
    generate_otp, send_otp_email,
    hash_password, verify_password, get_current_user,
)

router = APIRouter()

OTP_EXPIRY_MINUTES = 10

class GoogleLoginRequest(BaseModel):
    google_token: str

class PhoneLoginRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp:   str

class PasswordLoginRequest(BaseModel):
    email:    str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str

# ── Step 1a: Google login → sends OTP ────────────────────────────────────────

@router.post("/google")
async def google_login(body: GoogleLoginRequest):
    google_user = await verify_google_token(body.google_token)
    email = google_user.get("email")
    name  = google_user.get("name", "")

    if not email:
        raise HTTPException(status_code=400, detail="No email in Google token")

    conn = get_conn()
    cur  = conn.cursor()

    cur.execute("SELECT id, email, role, is_active, name FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        # Not a staff account. Frontend catches this and routes them to the
        # patient online-request form instead of showing an error.
        raise HTTPException(status_code=404, detail="not_registered")

    conn = get_conn()
    cur  = conn.cursor()

    if not user["is_active"]:
        cur.close(); conn.close()
        raise HTTPException(status_code=403, detail="Account deactivated. Contact admin.")

    otp     = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    cur.execute(
        "UPDATE users SET otp_code = %s, otp_expires_at = %s WHERE id = %s",
        (otp, expires, user["id"])
    )
    conn.commit()
    cur.close()
    conn.close()

    send_otp_email(user["email"], otp, user["name"] or name)

    return {
        "message": f"OTP sent to {user['email']}",
        "email":   user["email"],
        "requires_otp": True
    }

# ── Step 1b: Phone login → looks up by phone, sends OTP to email ─────────────

@router.post("/request-otp")
def request_otp(body: PhoneLoginRequest):
    conn = get_conn()
    cur  = conn.cursor()

    phone = body.email.strip()
    if phone.startswith("0"):
        phone = "+92" + phone[1:]

    cur.execute("SELECT id, email, role, is_active, name FROM users WHERE phone = %s", (phone,))
    user = cur.fetchone()

    if not user:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="No account found with this phone number.")

    if not user["is_active"]:
        cur.close(); conn.close()
        raise HTTPException(status_code=403, detail="Account deactivated. Contact admin.")

    otp     = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    cur.execute(
        "UPDATE users SET otp_code = %s, otp_expires_at = %s WHERE id = %s",
        (otp, expires, user["id"])
    )
    conn.commit()
    cur.close()
    conn.close()

    send_otp_email(user["email"], otp, user["name"] or "")

    return {
        "message": f"OTP sent to {user['email']}",
        "email":   user["email"],
        "requires_otp": True
    }

# ── Password login → return JWT directly (no OTP) ────────────────────────────

@router.post("/login")
def password_login(body: PasswordLoginRequest):
    conn = get_conn()
    cur  = conn.cursor()

    cur.execute(
        "SELECT id, email, role, is_active, name, password_hash FROM users WHERE email = %s",
        (body.email.strip().lower(),)
    )
    user = cur.fetchone()
    cur.close(); conn.close()

    # Same generic error whether the account doesn't exist or the password is
    # wrong, so we don't leak which registered emails exist.
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account deactivated. Contact admin.")

    token = create_jwt(user["id"], user["email"], user["role"])
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "id":    user["id"],
            "email": user["email"],
            "role":  user["role"],
            "name":  user["name"],
        }
    }

# ── Logged-in user changes their own password ─────────────────────────────────

@router.post("/change-password")
def change_password(body: ChangePasswordRequest, user=Security(get_current_user)):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("SELECT id, password_hash FROM users WHERE id = %s", (user["sub"],))
    row = cur.fetchone()

    if not row or not verify_password(body.current_password, row["password_hash"]):
        cur.close(); conn.close()
        raise HTTPException(status_code=401, detail="Current password is incorrect.")

    if len(body.new_password) < 8:
        cur.close(); conn.close()
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")

    cur.execute(
        "UPDATE users SET password_hash = %s WHERE id = %s",
        (hash_password(body.new_password), user["sub"])
    )
    conn.commit()
    cur.close(); conn.close()
    return {"message": "Password updated."}

# ── Step 2: Verify OTP → return JWT ──────────────────────────────────────────

@router.post("/verify-otp")
def verify_otp(body: VerifyOTPRequest):
    conn = get_conn()
    cur  = conn.cursor()

    cur.execute(
        "SELECT id, email, role, is_active, name, otp_code, otp_expires_at FROM users WHERE email = %s",
        (body.email,)
    )
    user = cur.fetchone()

    if not user:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    if not user["otp_code"]:
        cur.close(); conn.close()
        raise HTTPException(status_code=400, detail="No OTP requested. Please login again.")

    if user["otp_code"] != body.otp.strip():
        cur.close(); conn.close()
        raise HTTPException(status_code=401, detail="Incorrect OTP.")

    if user["otp_expires_at"] and datetime.now(timezone.utc) > user["otp_expires_at"]:
        cur.close(); conn.close()
        raise HTTPException(status_code=401, detail="OTP expired. Please login again.")

    cur.execute("UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = %s", (user["id"],))
    conn.commit()
    cur.close()
    conn.close()

    token = create_jwt(user["id"], user["email"], user["role"])
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "id":    user["id"],
            "email": user["email"],
            "role":  user["role"],
            "name":  user["name"],
        }
    }
