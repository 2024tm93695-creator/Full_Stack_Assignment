import os
from datetime import datetime, timezone
from typing import Optional

import socketio
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI",                   "mongodb://localhost:27017/smart_traffic_parking")
PORT      = int(os.getenv("NOTIFICATION_SERVICE_PORT", 5004))

# ── Socket.IO + FastAPI setup ─────────────────────────────────────────────────
sio         = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
fastapi_app = FastAPI(title="Notification Service")
fastapi_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app = socketio.ASGIApp(sio, fastapi_app)

_client     = AsyncIOMotorClient(MONGO_URI)
_db         = _client.smart_traffic_parking
notif_col   = _db.notifications

# ── Helpers ───────────────────────────────────────────────────────────────────

def _fix(doc: dict) -> dict:
    if doc is None:
        return doc
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = _fix(v)
        elif isinstance(v, list):
            out[k] = [_fix(i) if isinstance(i, dict) else (str(i) if isinstance(i, ObjectId) else i) for i in v]
        else:
            out[k] = v
    return out

# ── Startup ───────────────────────────────────────────────────────────────────

@fastapi_app.on_event("startup")
async def startup():
    await notif_col.create_index("userId")
    await notif_col.create_index([("userId", 1), ("createdAt", -1)])

# ── Socket.IO events ──────────────────────────────────────────────────────────

@sio.event
async def connect(sid, environ):
    print(f"Notif client connected: {sid}")

@sio.event
async def join(sid, user_id: str):
    await sio.enter_room(sid, f"user:{user_id}")
    print(f"User {user_id} joined notifications room")

@sio.event
async def disconnect(sid):
    print(f"Notif client disconnected: {sid}")

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class NotifBody(BaseModel):
    userId:   str
    type:     Optional[str] = "info"
    title:    str
    message:  str
    data:     Optional[dict] = None
    priority: Optional[str] = "medium"

# ── HTTP Routes ───────────────────────────────────────────────────────────────

@fastapi_app.get("/api/notifications")
async def get_notifications(
    x_user_id:  Optional[str] = Header(None),
    userId:     Optional[str] = None,
    page:       int  = 1,
    limit:      int  = 20,
    unreadOnly: bool = False,
):
    uid = x_user_id or userId
    if not uid:
        raise HTTPException(400, "userId required")
    filt: dict = {"userId": uid}
    if unreadOnly:
        filt["isRead"] = False
    skip  = (page - 1) * limit
    docs  = await notif_col.find(filt).sort("createdAt", -1).skip(skip).limit(limit).to_list(None)
    total = await notif_col.count_documents(filt)
    unread = await notif_col.count_documents({"userId": uid, "isRead": False})
    return {"notifications": [_fix(d) for d in docs], "total": total, "unreadCount": unread}


@fastapi_app.post("/api/notifications", status_code=201)
async def create_notification(body: NotifBody):
    doc = {
        "userId":    body.userId,
        "type":      body.type,
        "title":     body.title,
        "message":   body.message,
        "data":      body.data or {},
        "priority":  body.priority,
        "isRead":    False,
        "createdAt": datetime.now(timezone.utc),
    }
    result     = await notif_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    out        = _fix(doc)
    await sio.emit("notification:new", out, room=f"user:{body.userId}")
    return out


@fastapi_app.put("/api/notifications/{notif_id}/read")
async def mark_as_read(notif_id: str):
    result = await notif_col.find_one_and_update(
        {"_id": ObjectId(notif_id)}, {"$set": {"isRead": True}}, return_document=True
    )
    if not result:
        raise HTTPException(404, "Notification not found")
    return _fix(result)


@fastapi_app.put("/api/notifications/read-all")
async def mark_all_read(
    x_user_id: Optional[str] = Header(None),
    userId:    Optional[str] = None,
):
    uid = x_user_id or userId
    await notif_col.update_many({"userId": uid, "isRead": False}, {"$set": {"isRead": True}})
    return {"message": "All notifications marked as read"}


@fastapi_app.delete("/api/notifications/{notif_id}")
async def delete_notification(notif_id: str):
    await notif_col.delete_one({"_id": ObjectId(notif_id)})
    return {"message": "Notification deleted"}


@fastapi_app.get("/health")
async def health():
    return {"status": "Notification Service Running", "port": PORT}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT)
