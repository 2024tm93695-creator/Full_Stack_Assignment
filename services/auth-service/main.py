import os
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import bcrypt
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

load_dotenv()

MONGO_URI  = os.getenv("MONGO_URI",          "mongodb://localhost:27017/smart_traffic_parking")
JWT_SECRET = os.getenv("JWT_SECRET",          "smartpark_jwt_secret_2024")
PORT       = int(os.getenv("AUTH_SERVICE_PORT", 5001))

app = FastAPI(title="Auth Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def _hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(12)).decode()

def _verify_pw(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

_client    = AsyncIOMotorClient(MONGO_URI)
_db        = _client.smart_traffic_parking
users_col  = _db.users

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    name:          str
    email:         EmailStr
    password:      str = Field(min_length=6)
    phone:         str = ""
    vehicleNumber: str = ""
    vehicleType:   str = "car"

class LoginBody(BaseModel):
    email:    EmailStr
    password: str

class UpdateBody(BaseModel):
    name:          Optional[str] = None
    phone:         Optional[str] = None
    vehicleNumber: Optional[str] = None
    vehicleType:   Optional[str] = None

# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_token(user_id: str, role: str) -> str:
    return jwt.encode({"id": user_id, "role": role}, JWT_SECRET, algorithm="HS256")

def _safe(u: dict) -> dict:
    return {
        "id":            str(u["_id"]),
        "name":          u.get("name"),
        "email":         u.get("email"),
        "role":          u.get("role", "user"),
        "vehicleType":   u.get("vehicleType"),
        "vehicleNumber": u.get("vehicleNumber"),
        "phone":         u.get("phone"),
    }

async def _current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authorized")
    try:
        decoded = jwt.decode(authorization[7:], JWT_SECRET, algorithms=["HS256"])
        user    = await users_col.find_one({"_id": ObjectId(decoded["id"])})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except Exception:
        raise HTTPException(401, "Token invalid or expired")

def _admin_only(current_user=Depends(_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return current_user

# ── Seed demo users on startup ────────────────────────────────────────────────

DEMO_USERS = [
    {
        "name": "Demo User", "email": "user@demo.com", "password": "demo123",
        "phone": "9876543210", "vehicleNumber": "TS09AB1234",
        "vehicleType": "car", "role": "user",
    },
    {
        "name": "Admin User", "email": "admin@demo.com", "password": "admin123",
        "phone": "9000000000", "vehicleNumber": "TS01AA0001",
        "vehicleType": "car", "role": "admin",
    },
]

@app.on_event("startup")
async def seed_demo_users():
    await users_col.create_index("email", unique=True)
    for u in DEMO_USERS:
        if not await users_col.find_one({"email": u["email"]}):
            await users_col.insert_one({
                "name":          u["name"],
                "email":         u["email"],
                "password":      _hash_pw(u["password"]),
                "phone":         u["phone"],
                "vehicleNumber": u["vehicleNumber"],
                "vehicleType":   u["vehicleType"],
                "role":          u["role"],
                "isActive":      True,
                "createdAt":     datetime.now(timezone.utc),
            })
            print(f"✅ Seeded demo user: {u['email']} (role: {u['role']})")

# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register", status_code=201)
async def register(body: RegisterBody):
    if await users_col.find_one({"email": body.email}):
        raise HTTPException(400, "Email already registered")
    hashed = _hash_pw(body.password)
    doc    = {
        "name":          body.name,
        "email":         body.email,
        "password":      hashed,
        "phone":         body.phone,
        "vehicleNumber": body.vehicleNumber,
        "vehicleType":   body.vehicleType,
        "role":          "user",
        "isActive":      True,
        "createdAt":     datetime.now(timezone.utc),
    }
    result     = await users_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"token": _make_token(str(result.inserted_id), "user"), "user": _safe(doc)}


@app.post("/api/auth/login")
async def login(body: LoginBody):
    user = await users_col.find_one({"email": body.email})
    if not user or not _verify_pw(body.password, user["password"]):
        raise HTTPException(401, "Invalid email or password")
    return {"token": _make_token(str(user["_id"]), user.get("role", "user")), "user": _safe(user)}


@app.get("/api/auth/profile")
async def get_profile(current_user=Depends(_current_user)):
    return _safe(current_user)


@app.put("/api/auth/profile")
async def update_profile(body: UpdateBody, current_user=Depends(_current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await users_col.update_one({"_id": current_user["_id"]}, {"$set": update})
    updated = await users_col.find_one({"_id": current_user["_id"]})
    return _safe(updated)


@app.get("/api/auth/users")
async def get_all_users(_=Depends(_admin_only)):
    users = await users_col.find({}, {"password": 0}).sort("createdAt", -1).to_list(None)
    return [_safe(u) for u in users]


@app.get("/health")
async def health():
    return {"status": "Auth Service Running", "port": PORT}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
