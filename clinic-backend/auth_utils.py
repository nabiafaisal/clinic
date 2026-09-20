import os
import jwt
import httpx
import random
import secrets
import string
import bcrypt
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY   = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM    = "HS256"
TOKEN_EXPIRY = 60 * 24  # 24 hours

# Gmail SMTP (free, no sandbox/recipient restrictions like MailerSend's
# trial domain). GMAIL_ADDRESS is the sending account; GMAIL_APP_PASSWORD is
# a 16-character App Password generated from that account's Google settings
# (requires 2-Step Verification to be on) — NOT the account's login password.
GMAIL_ADDRESS      = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
SENDER_NAME         = "Dr. Arshad Mahmood Clinic"

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

# ── OTP generation & email sending via Gmail SMTP (free) ─────────────────────

def generate_otp() -> str:
    return str(random.randint(100000, 999999))

def send_email(to_email: str, subject: str, html: str, user_name: str = "", *, raise_on_failure: bool = True) -> bool:
    """Sends via Gmail SMTP (smtplib), using an App Password. Returns
    True/False on success when raise_on_failure=False, otherwise raises
    HTTPException on failure."""
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        if raise_on_failure:
            raise HTTPException(status_code=500, detail="Gmail sender not configured (GMAIL_ADDRESS / GMAIL_APP_PASSWORD).")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{SENDER_NAME} <{GMAIL_ADDRESS}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_ADDRESS, [to_email], msg.as_string())
    except smtplib.SMTPException as e:
        if raise_on_failure:
            raise HTTPException(status_code=500, detail=f"Failed to send email: {e}")
        return False
    except OSError as e:
        # network-level failure (timeout, DNS, connection refused, etc.)
        if raise_on_failure:
            raise HTTPException(status_code=500, detail=f"Failed to reach Gmail SMTP: {e}")
        return False

    return True

def send_otp_email(to_email: str, otp: str, user_name: str = ""):
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
      <p style="color: #aaa; font-size: 11px; text-align: center;">Dr. Arshad Mahmood Clinic · Lahore, Pakistan</p>
    </div>
    """
    send_email(to_email, f"Your login OTP — {otp}", html, user_name)

def send_password_reset_email(to_email: str, new_password: str, user_name: str = "") -> bool:
    """Best-effort — never raises. Returns True if MailerSend accepted it."""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9f9f7; border-radius: 12px;">
      <h2 style="color: #2d6a4f; margin-bottom: 4px;">Dr. Arshad Mahmood Clinic</h2>
      <p style="color: #666; font-size: 13px; margin-bottom: 28px;">Patient Record Management System</p>
      <p style="color: #333; font-size: 15px;">Hello{' ' + user_name if user_name else ''},</p>
      <p style="color: #333; font-size: 15px;">Your password has been reset by the clinic admin. Your new password is:</p>
      <div style="background: #fff; border: 2px solid #2d6a4f; border-radius: 10px; padding: 16px; text-align: center; margin: 24px 0;">
        <span style="font-size: 22px; font-weight: 700; letter-spacing: 2px; color: #1b4332; font-family: monospace;">
          {new_password}
        </span>
      </div>
      <p style="color: #888; font-size: 13px;">Please log in and change this password as soon as possible.</p>
      <hr style="border: none; border-top: 1px solid #e5e2d9; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 11px; text-align: center;">Dr. Arshad Mahmood Clinic · Lahore, Pakistan</p>
    </div>
    """
    return send_email(to_email, "Your clinic account password was reset", html, user_name, raise_on_failure=False)

# ── Password hashing ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False

def generate_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

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

def is_superadmin(user): return user["role"] == "superadmin"
def is_admin(user):      return user["role"] in ("superadmin", "admin")
def is_reception(user):  return user["role"] in ("superadmin", "admin", "reception")
