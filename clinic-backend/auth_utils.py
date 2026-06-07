import os
import jwt
import httpx
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY   = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM    = "HS256"
TOKEN_EXPIRY = 60 * 24  # 24 hours
OTP_EXPIRY   = 10       # minutes

SMTP_EMAIL    = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

bearer_scheme = HTTPBearer()

# ── Google token verification ─────────────────────────────────────────────────

async def verify_google_token(token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
        )
    if resp.status_code == 200:
        return resp.json()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"}
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    return resp.json()

# ── OTP generation & email sending ───────────────────────────────────────────

def generate_otp() -> str:
    return str(random.randint(100000, 999999))

def send_otp_email(to_email: str, otp: str, user_name: str = ""):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        raise HTTPException(status_code=500, detail="SMTP not configured")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your OTP for Dr. Arshad Mahmood Clinic — {otp}"
    msg["From"]    = f"Dr. Arshad Mahmood Clinic <{SMTP_EMAIL}>"
    msg["To"]      = to_email

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9f9f7; border-radius: 12px;">
      <h2 style="color: #2d6a4f; margin-bottom: 4px;">Dr. Arshad Mahmood Clinic</h2>
      <p style="color: #666; font-size: 13px; margin-bottom: 28px;">Patient Record Management System</p>

      <p style="color: #333; font-size: 15px;">Hello{' ' + user_name if user_name else ''},</p>
      <p style="color: #333; font-size: 15px;">Your one-time login code is:</p>

      <div style="background: #fff; border: 2px solid #2d6a4f; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 40px; font-weight: 700; letter-spacing: 10px; color: #1b4332; font-family: monospace;">
          {otp}
        </span>
      </div>

      <p style="color: #888; font-size: 13px;">This code expires in <strong>10 minutes</strong>.</p>
      <p style="color: #888; font-size: 13px;">If you did not request this, please ignore this email.</p>

      <hr style="border: none; border-top: 1px solid #e5e2d9; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 11px; text-align: center;">
        Dr. Arshad Mahmood Clinic · Lahore, Pakistan
      </p>
    </div>
    """

    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
    server.ehlo()
    server.starttls()
    server.login(SMTP_EMAIL, SMTP_PASSWORD)
    server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {str(e)}")

# ── JWT issue / verify ────────────────────────────────────────────────────────

def create_jwt(user_id: int, email: str, role: str) -> str:
    payload = {
        "sub":   str(user_id),
        "email": email,
        "role":  role,
        "exp":   datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRY),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── FastAPI dependency ────────────────────────────────────────────────────────

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)) -> dict:
    return decode_jwt(credentials.credentials)

def require_role(*roles):
    def dependency(user: dict = Security(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dependency

# Role helpers
def is_superadmin(user): return user["role"] == "superadmin"
def is_admin(user):      return user["role"] in ("superadmin", "admin")
def is_reception(user):  return user["role"] in ("superadmin", "admin", "reception")
