import asyncio
import math
import os
import random
from datetime import datetime, timezone
from typing import Optional

import socketio
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI",              "mongodb://localhost:27017/smart_traffic_parking")
PORT      = int(os.getenv("TRAFFIC_SERVICE_PORT", 5003))

# ── Socket.IO + FastAPI setup ─────────────────────────────────────────────────
sio         = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
fastapi_app = FastAPI(title="Traffic Service")
fastapi_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Combined ASGI app: socket.io handles WS, fastapi_app handles HTTP
app = socketio.ASGIApp(sio, fastapi_app)

_client      = AsyncIOMotorClient(MONGO_URI)
_db          = _client.smart_traffic_parking
traffic_col  = _db.trafficdatas

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

# ── IoT Simulator ─────────────────────────────────────────────────────────────

ROADS = [
    {"roadName": "HITEC City Main Road",  "area": "HITEC City",    "coords": [78.3733, 17.4435], "normalSpeed": 50},
    {"roadName": "Gachibowli Flyover",    "area": "Gachibowli",    "coords": [78.3499, 17.4404], "normalSpeed": 60},
    {"roadName": "Banjara Hills Road 12", "area": "Banjara Hills", "coords": [78.4479, 17.4191], "normalSpeed": 40},
    {"roadName": "Jubilee Hills Road 36", "area": "Jubilee Hills", "coords": [78.4083, 17.4313], "normalSpeed": 45},
    {"roadName": "Madhapur Cross Road",   "area": "Madhapur",      "coords": [78.3922, 17.4482], "normalSpeed": 50},
    {"roadName": "Kondapur Main Road",    "area": "Kondapur",      "coords": [78.3548, 17.4617], "normalSpeed": 55},
    {"roadName": "Kukatpally Bypass",     "area": "Kukatpally",    "coords": [78.3980, 17.4849], "normalSpeed": 65},
    {"roadName": "Ameerpet Junction",     "area": "Ameerpet",      "coords": [78.4487, 17.4355], "normalSpeed": 30},
    {"roadName": "Secunderabad Ring Road","area": "Secunderabad",  "coords": [78.4980, 17.4380], "normalSpeed": 55},
    {"roadName": "Begumpet Airport Road", "area": "Begumpet",      "coords": [78.4694, 17.4444], "normalSpeed": 60},
    {"roadName": "Outer Ring Road West",  "area": "ORR West",      "coords": [78.3200, 17.4600], "normalSpeed": 80},
    {"roadName": "NH-65 Hyderabad Bypass","area": "NH65",          "coords": [78.5100, 17.3900], "normalSpeed": 80},
]

_state = [20 + random.random() * 30 for _ in ROADS]

def _level(score: float) -> str:
    if score < 25: return "free"
    if score < 50: return "moderate"
    if score < 75: return "heavy"
    return "severe"

def _incident(score: float) -> str:
    if score < 55: return "none"
    pool = ["accident", "roadwork", "event", "breakdown", "none", "none", "none"]
    return random.choice(pool)

async def _run_simulation():
    h        = datetime.now().hour
    is_peak  = (8 <= h <= 10) or (17 <= h <= 20)
    is_off   = 1 <= h <= 5
    base     = 35 if is_peak else (-15 if is_off else 0)

    inserts = []
    for i, road in enumerate(ROADS):
        _state[i] = max(5.0, min(90.0, _state[i] + (random.random() - 0.45) * 8))
        score     = round(max(5, min(95, _state[i] + base + (random.random() * 6 - 3))))
        incident  = _incident(score)
        speed     = max(5, round(road["normalSpeed"] * (1 - score / 130)))
        doc       = {
            "roadName":            road["roadName"],
            "area":                road["area"],
            "location":            {"type": "Point", "coordinates": road["coords"]},
            "congestionLevel":     _level(score),
            "congestionScore":     score,
            "averageSpeed":        speed,
            "normalSpeed":         road["normalSpeed"],
            "vehicleCount":        int(score * 8 + random.random() * 40),
            "incidentType":        incident,
            "incidentDescription": f"{incident} reported on {road['roadName']}" if incident != "none" else "",
            "etaDelay":            round(score / 10),
            "timestamp":           datetime.now(timezone.utc),
        }
        inserts.append(traffic_col.insert_one(dict(doc)))
        emit_doc = dict(doc, timestamp=doc["timestamp"].isoformat())
        await sio.emit("traffic:update", emit_doc)
        if score >= 75:
            await sio.emit("traffic:alert", {
                "area":    road["area"],
                "message": f"Heavy congestion on {road['roadName']}. Consider alternate routes.",
                "score":   score,
            })

    await asyncio.gather(*inserts, return_exceptions=True)
    cutoff = datetime.now(timezone.utc).replace(
        hour=datetime.now().hour, minute=0, second=0
    )
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    await traffic_col.delete_many({"timestamp": {"$lt": cutoff}})

async def _simulation_loop():
    await traffic_col.create_index([("location", "2dsphere")])
    await traffic_col.create_index("area")
    await traffic_col.create_index([("timestamp", -1)])
    print("🤖 IoT Traffic Simulation started (interval: 15s)")
    while True:
        await _run_simulation()
        await asyncio.sleep(15)

@fastapi_app.on_event("startup")
async def startup():
    asyncio.create_task(_simulation_loop())

# ── Socket.IO events ──────────────────────────────────────────────────────────

@sio.event
async def connect(sid, environ):
    print(f"Traffic client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Traffic client disconnected: {sid}")

# ── HTTP Routes ───────────────────────────────────────────────────────────────

@fastapi_app.get("/api/traffic")
async def get_all_traffic(area: Optional[str] = None, congestion: Optional[str] = None):
    match: dict = {}
    if area:
        match["area"] = {"$regex": area, "$options": "i"}
    if congestion:
        match["congestionLevel"] = congestion
    pipeline = [
        {"$match": match},
        {"$sort": {"timestamp": -1}},
        {"$group": {"_id": "$roadName", "doc": {"$first": "$$ROOT"}}},
        {"$replaceRoot": {"newRoot": "$doc"}},
    ]
    docs = await traffic_col.aggregate(pipeline).to_list(None)
    return [_fix(d) for d in docs]


@fastapi_app.get("/api/traffic/nearby")
async def get_nearby(
    lat: float = Query(...), lng: float = Query(...), radius: int = Query(4000)
):
    docs = await traffic_col.find({
        "location": {"$near": {
            "$geometry": {"type": "Point", "coordinates": [lng, lat]},
            "$maxDistance": radius,
        }}
    }).sort("timestamp", -1).limit(20).to_list(None)
    return [_fix(d) for d in docs]


@fastapi_app.get("/api/traffic/eta")
async def get_eta(
    fromLat: float = Query(...), fromLng: float = Query(...),
    toLat:   float = Query(...), toLng:   float = Query(...),
):
    R    = 6371
    dLat = math.radians(toLat - fromLat)
    dLon = math.radians(toLng - fromLng)
    a    = (math.sin(dLat/2)**2 +
            math.cos(math.radians(fromLat)) * math.cos(math.radians(toLat)) * math.sin(dLon/2)**2)
    dist = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    mid_lat = (fromLat + toLat) / 2
    mid_lng = (fromLng + toLng) / 2
    nearby  = await traffic_col.find({
        "location": {"$near": {"$geometry": {"type":"Point","coordinates":[mid_lng, mid_lat]}, "$maxDistance": 6000}}
    }).limit(6).to_list(None)

    avg_score  = sum(t["congestionScore"] for t in nearby) / len(nearby) if nearby else 20
    speed      = max(10, 40 * (1 - avg_score / 140))
    eta_min    = math.ceil((dist / speed) * 60)
    delay_min  = round(avg_score / 8)

    return {
        "distance":      round(dist, 2),
        "etaMinutes":    eta_min,
        "delayMinutes":  delay_min,
        "congestionScore": round(avg_score),
        "trafficLevel":  _level(avg_score),
    }


@fastapi_app.get("/api/traffic/heatmap")
async def get_heatmap():
    pipeline = [
        {"$sort": {"timestamp": -1}},
        {"$group": {"_id": "$roadName", "doc": {"$first": "$$ROOT"}}},
        {"$replaceRoot": {"newRoot": "$doc"}},
        {"$project": {"location": 1, "congestionScore": 1, "area": 1, "roadName": 1}},
    ]
    docs = await traffic_col.aggregate(pipeline).to_list(None)
    return [{
        "lat":       d["location"]["coordinates"][1],
        "lng":       d["location"]["coordinates"][0],
        "intensity": d["congestionScore"] / 100,
        "area":      d["area"],
        "road":      d["roadName"],
    } for d in docs]


@fastapi_app.get("/api/traffic/stats")
async def get_stats():
    pipeline = [
        {"$sort": {"timestamp": -1}},
        {"$group": {"_id": "$roadName", "doc": {"$first": "$$ROOT"}}},
        {"$group": {"_id": "$doc.congestionLevel", "count": {"$sum": 1}}},
    ]
    docs = await traffic_col.aggregate(pipeline).to_list(None)
    return [{"_id": d["_id"], "count": d["count"]} for d in docs]


@fastapi_app.get("/health")
async def health():
    return {"status": "Traffic Service Running", "port": PORT}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT)
