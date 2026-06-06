from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os

load_dotenv()

from routers import patients, visits, auth, users

app = FastAPI(title="Dr. Arshad Mahmood Clinic API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router,     prefix="/auth",     tags=["Auth"])
app.include_router(users.router,    prefix="/users",    tags=["Users"])
app.include_router(patients.router, prefix="/patients", tags=["Patients"])
app.include_router(visits.router,   prefix="/visits",   tags=["Visits"])

@app.get("/")
def root():
    return {"status": "ok", "clinic": "Dr. Arshad Mahmood Clinic"}
allow_origins=[
    "http://localhost:3000",
    "https://your-deployed-frontend-url.vercel.app"
],