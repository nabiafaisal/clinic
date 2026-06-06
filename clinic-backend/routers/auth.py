from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_conn
from auth_utils import verify_google_token, create_jwt

router = APIRouter()

ALLOWED_EMAILS = None

class GoogleLoginRequest(BaseModel):
    google_token: str

@router.post("/google")
async def google_login(body: GoogleLoginRequest):
    google_user = await verify_google_token(body.google_token)
    email = google_user.get("email")
    name  = google_user.get("name", "")

    if not email:
        raise HTTPException(status_code=400, detail="No email in Google token")

    conn = get_conn()
    cur  = conn.cursor()

    cur.execute("SELECT id, email, role, is_active FROM users WHERE email = %s", (email,))
    user = cur.fetchone()

    if not user:
        cur.execute(
            "INSERT INTO users (email, name, role) VALUES (%s, %s, 'reception') RETURNING id, email, role, is_active",
            (email, name)
        )
        user = cur.fetchone()
        conn.commit()

    cur.close()
    conn.close()

    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account deactivated. Contact admin.")

    token = create_jwt(user["id"], user["email"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id":    user["id"],
            "email": user["email"],
            "role":  user["role"],
            "name":  name,
        }
    }