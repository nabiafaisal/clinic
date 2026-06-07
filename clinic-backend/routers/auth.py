from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from db import get_conn
from auth_utils import (
    verify_google_token, create_jwt,
    generate_otp, send_otp_email
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

    if not user:
        # Auto-register as reception, pending superadmin approval
        cur.execute(
            "INSERT INTO users (email, name, role) VALUES (%s, %s, 'reception') RETURNING id, email, role, is_active, name",
            (email, name)
        )
        user = cur.fetchone()
        conn.commit()

    if not user["is_active"]:
        cur.close(); conn.close()
        raise HTTPException(status_code=403, detail="Account deactivated. Contact admin.")

    if not user.get("email"):
        cur.close(); conn.close()
        raise HTTPException(status_code=403, detail="No email registered for OTP.")

    # Generate and store OTP
    otp     = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    cur.execute(
        "UPDATE users SET otp_code = %s, otp_expires_at = %s WHERE id = %s",
        (otp, expires, user["id"])
    )
    conn.commit()
    cur.close()
    conn.close()

    # Send OTP to registered email
    send_otp_email(user["email"], otp, user["name"] or name)

    return {
        "message": f"OTP sent to {user['email']}",
        "email":   user["email"],
        "requires_otp": True
    }

# ── Step 1b: Email/phone login → sends OTP ───────────────────────────────────

@router.post("/request-otp")
def request_otp(body: PhoneLoginRequest):
    conn = get_conn()
    cur  = conn.cursor()

    cur.execute("SELECT id, email, role, is_active, name FROM users WHERE email = %s", (body.email,))
    user = cur.fetchone()

    if not user:
        cur.close(); conn.close()
        raise HTTPException(status_code=404, detail="No account found with this email.")

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

    # Clear OTP after successful use
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
