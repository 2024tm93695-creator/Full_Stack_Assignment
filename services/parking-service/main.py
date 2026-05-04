import math
import os
import random
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

load_dotenv()

MONGO_URI   = os.getenv("MONGO_URI",              "mongodb://localhost:27017/smart_traffic_parking")
NOTIF_URL   = os.getenv("NOTIF_SERVICE_URL",       "http://localhost:5004")
PORT        = int(os.getenv("PARKING_SERVICE_PORT", 5002))

app = FastAPI(title="Parking Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_client       = AsyncIOMotorClient(MONGO_URI)
_db           = _client.smart_traffic_parking
slots_col     = _db.parkingslots
bookings_col  = _db.bookings

# ── Helpers ───────────────────────────────────────────────────────────────────

def _sid(v):
    return str(v) if isinstance(v, ObjectId) else v

def _fix(doc: dict) -> dict:
    """Recursively convert ObjectIds and datetimes to JSON-safe types."""
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

async def _notify(payload: dict):
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            await c.post(f"{NOTIF_URL}/api/notifications", json=payload)
    except Exception:
        pass

# ── Seed on startup if empty ──────────────────────────────────────────────────

SEED_SLOTS = [
    {"name": "HITEC City Smart Park",       "slotCode": "HTC-001",
     "location": {"type": "Point", "coordinates": [78.3733, 17.4435]},
     "address": "Cyber Towers, HITEC City, Hyderabad", "area": "HITEC City",
     "vehicleTypes": ["car","bike"], "totalSlots": 120, "availableSlots": 45,
     "reservedSlots": 0, "pricePerHour": 40, "status": "available",
     "facilities": ["CCTV","Covered","EV Charging","24/7 Security","Lift"], "rating": 4.5,
     "operatingHours": {"open":"06:00","close":"23:00","is24Hours": False}, "isOperational": True},
    {"name": "Gachibowli IT Hub Parking",   "slotCode": "GCB-001",
     "location": {"type": "Point", "coordinates": [78.3499, 17.4404]},
     "address": "Near ISB Road, Gachibowli", "area": "Gachibowli",
     "vehicleTypes": ["car","bike","truck"], "totalSlots": 200, "availableSlots": 0,
     "reservedSlots": 0, "pricePerHour": 30, "status": "occupied",
     "facilities": ["CCTV","Open Air","Guard"], "rating": 3.8,
     "operatingHours": {"open":"06:00","close":"23:00","is24Hours": False}, "isOperational": True},
    {"name": "Banjara Hills Multi-Level",   "slotCode": "BJH-001",
     "location": {"type": "Point", "coordinates": [78.4479, 17.4191]},
     "address": "Road No. 12, Banjara Hills", "area": "Banjara Hills",
     "vehicleTypes": ["car","bike"], "totalSlots": 80, "availableSlots": 12,
     "reservedSlots": 0, "pricePerHour": 60, "status": "reserved",
     "facilities": ["CCTV","Covered","Valet","Car Wash","EV Charging"], "rating": 4.7,
     "operatingHours": {"open":"06:00","close":"23:00","is24Hours": False}, "isOperational": True},
    {"name": "Jubilee Hills Park & Go",     "slotCode": "JBH-001",
     "location": {"type": "Point", "coordinates": [78.4083, 17.4313]},
     "address": "Road No. 36, Jubilee Hills", "area": "Jubilee Hills",
     "vehicleTypes": ["car","bike"], "totalSlots": 60, "availableSlots": 35,
     "reservedSlots": 0, "pricePerHour": 50, "status": "available",
     "facilities": ["CCTV","Semi-Covered"], "rating": 4.2,
     "operatingHours": {"open":"06:00","close":"23:00","is24Hours": False}, "isOperational": True},
    {"name": "Madhapur Cyber Pearl",        "slotCode": "MDP-001",
     "location": {"type": "Point", "coordinates": [78.3922, 17.4482]},
     "address": "Cyber Pearl, Madhapur", "area": "Madhapur",
     "vehicleTypes": ["car","bike"], "totalSlots": 150, "availableSlots": 80,
     "reservedSlots": 0, "pricePerHour": 35, "status": "available",
     "facilities": ["CCTV","Covered","EV Charging","Cafeteria"], "rating": 4.3,
     "operatingHours": {"open":"06:00","close":"23:00","is24Hours": False}, "isOperational": True},
    {"name": "Kondapur Community Park",     "slotCode": "KDP-001",
     "location": {"type": "Point", "coordinates": [78.3548, 17.4617]},
     "address": "Kondapur Main Road, Near Botanical Garden", "area": "Kondapur",
     "vehicleTypes": ["car","bike","truck"], "totalSlots": 100, "availableSlots": 55,
     "reservedSlots": 0, "pricePerHour": 25, "status": "available",
     "facilities": ["Guard","Open Air","CCTV"], "rating": 3.9,
     "operatingHours": {"open":"06:00","close":"23:00","is24Hours": False}, "isOperational": True},
    {"name": "Kukatpally Metro Park",       "slotCode": "KKP-001",
     "location": {"type": "Point", "coordinates": [78.3980, 17.4849]},
     "address": "Near KPHB Metro Station, Kukatpally", "area": "Kukatpally",
     "vehicleTypes": ["car","bike"], "totalSlots": 90, "availableSlots": 70,
     "reservedSlots": 0, "pricePerHour": 20, "status": "available",
     "facilities": ["Covered","CCTV","Metro Access"], "rating": 4.1,
     "operatingHours": {"open":"05:00","close":"23:00","is24Hours": False}, "isOperational": True},
    {"name": "Ameerpet Central Parking",    "slotCode": "AMP-001",
     "location": {"type": "Point", "coordinates": [78.4487, 17.4355]},
     "address": "Ameerpet Cross Roads, Hyderabad", "area": "Ameerpet",
     "vehicleTypes": ["car","bike"], "totalSlots": 70, "availableSlots": 8,
     "reservedSlots": 0, "pricePerHour": 30, "status": "reserved",
     "facilities": ["CCTV","Open Air"], "rating": 3.6,
     "operatingHours": {"open":"06:00","close":"23:00","is24Hours": False}, "isOperational": True},
    {"name": "Secunderabad Station Parking","slotCode": "SCB-001",
     "location": {"type": "Point", "coordinates": [78.4980, 17.4380]},
     "address": "Near Secunderabad Railway Station", "area": "Secunderabad",
     "vehicleTypes": ["car","bike","truck"], "totalSlots": 300, "availableSlots": 150,
     "reservedSlots": 0, "pricePerHour": 15, "status": "available",
     "facilities": ["Guard","Open Air","Restrooms"], "rating": 3.5,
     "operatingHours": {"open":"00:00","close":"23:59","is24Hours": True}, "isOperational": True},
    {"name": "Begumpet Airport Road Park",  "slotCode": "BGP-001",
     "location": {"type": "Point", "coordinates": [78.4694, 17.4444]},
     "address": "Airport Road, Begumpet", "area": "Begumpet",
     "vehicleTypes": ["car","truck"], "totalSlots": 50, "availableSlots": 30,
     "reservedSlots": 0, "pricePerHour": 80, "status": "available",
     "facilities": ["CCTV","Covered","Valet","24/7 Security","EV Charging","Lounge"], "rating": 4.8,
     "operatingHours": {"open":"00:00","close":"23:59","is24Hours": True}, "isOperational": True},
]

@app.on_event("startup")
async def startup():
    await slots_col.create_index([("location", "2dsphere")])
    await slots_col.create_index("area")
    await slots_col.create_index("status")
    await slots_col.create_index("pricePerHour")
    await bookings_col.create_index("userId")
    await bookings_col.create_index("status")
    if await slots_col.count_documents({}) == 0:
        await slots_col.insert_many([dict(s, createdAt=datetime.now(timezone.utc)) for s in SEED_SLOTS])
        print(f"✅ Seeded {len(SEED_SLOTS)} parking slots")

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class BookingBody(BaseModel):
    slotId:        str
    vehicleNumber: str
    vehicleType:   str
    startTime:     str
    endTime:       str
    userName:      Optional[str] = "User"

class CheckInBody(BaseModel):
    otp: str

# ── Parking Slot routes ───────────────────────────────────────────────────────

@app.get("/api/parking/slots/stats")
async def get_stats():
    pipeline = [{"$group": {
        "_id": None,
        "totalSlots":     {"$sum": "$totalSlots"},
        "availableSlots": {"$sum": "$availableSlots"},
        "reservedSlots":  {"$sum": "$reservedSlots"},
        "totalLocations": {"$sum": 1},
        "avgPrice":       {"$avg": "$pricePerHour"},
    }}]
    agg      = await slots_col.aggregate(pipeline).to_list(1)
    by_status = await slots_col.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(None)
    result = agg[0] if agg else {}
    result.pop("_id", None)
    result["byStatus"] = [{"_id": r["_id"], "count": r["count"]} for r in by_status]
    return result


@app.get("/api/parking/slots/nearby")
async def get_nearby(
    lat: float = Query(...), lng: float = Query(...),
    radius: int = Query(5000), vehicleType: Optional[str] = None,
):
    filt: dict = {
        "isOperational": True,
        "location": {"$near": {"$geometry": {"type":"Point","coordinates":[lng, lat]}, "$maxDistance": radius}},
    }
    if vehicleType:
        filt["vehicleTypes"] = vehicleType
    docs = await slots_col.find(filt).limit(20).to_list(None)
    return [_fix(d) for d in docs]


@app.get("/api/parking/slots")
async def get_all_slots(
    area: Optional[str] = None, vehicleType: Optional[str] = None,
    status: Optional[str] = None, minPrice: Optional[float] = None,
    maxPrice: Optional[float] = None, page: int = 1, limit: int = 20,
):
    filt: dict = {"isOperational": True}
    if area:
        filt["area"] = re.compile(area, re.IGNORECASE)
    if vehicleType:
        filt["vehicleTypes"] = vehicleType
    if status:
        filt["status"] = status
    if minPrice or maxPrice:
        filt["pricePerHour"] = {}
        if minPrice:
            filt["pricePerHour"]["$gte"] = minPrice
        if maxPrice:
            filt["pricePerHour"]["$lte"] = maxPrice

    skip  = (page - 1) * limit
    docs  = await slots_col.find(filt).sort("availableSlots", -1).skip(skip).limit(limit).to_list(None)
    total = await slots_col.count_documents(filt)
    return {"slots": [_fix(d) for d in docs], "total": total, "page": page,
            "pages": math.ceil(total / limit)}


@app.get("/api/parking/slots/{slot_id}")
async def get_slot(slot_id: str):
    doc = await slots_col.find_one({"_id": ObjectId(slot_id)})
    if not doc:
        raise HTTPException(404, "Slot not found")
    return _fix(doc)


@app.post("/api/parking/slots", status_code=201)
async def create_slot(body: dict):
    body["createdAt"] = datetime.now(timezone.utc)
    result = await slots_col.insert_one(body)
    doc    = await slots_col.find_one({"_id": result.inserted_id})
    return _fix(doc)


@app.put("/api/parking/slots/{slot_id}")
async def update_slot(slot_id: str, body: dict):
    result = await slots_col.find_one_and_update(
        {"_id": ObjectId(slot_id)}, {"$set": body}, return_document=True
    )
    if not result:
        raise HTTPException(404, "Slot not found")
    return _fix(result)


@app.delete("/api/parking/slots/{slot_id}")
async def delete_slot(slot_id: str):
    await slots_col.delete_one({"_id": ObjectId(slot_id)})
    return {"message": "Slot deleted successfully"}

# ── Booking routes ────────────────────────────────────────────────────────────

@app.get("/api/parking/bookings/stats")
async def booking_stats():
    by_status = await bookings_col.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(None)
    revenue   = await bookings_col.aggregate([
        {"$match": {"status": {"$in": ["confirmed","active","completed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$totalAmount"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    rev = revenue[0] if revenue else {"total": 0, "count": 0}
    rev.pop("_id", None)
    return {"byStatus": [{"_id": r["_id"], "count": r["count"]} for r in by_status], "revenue": rev}


@app.get("/api/parking/bookings/all")
async def get_all_bookings(page: int = 1, limit: int = 20, status: Optional[str] = None):
    filt  = {"status": status} if status else {}
    skip  = (page - 1) * limit
    docs  = await bookings_col.find(filt).sort("createdAt", -1).skip(skip).limit(limit).to_list(None)
    total = await bookings_col.count_documents(filt)
    return {"bookings": [_fix(d) for d in docs], "total": total}


@app.get("/api/parking/bookings")
async def get_user_bookings(
    x_user_id: Optional[str] = Header(None),
    status: Optional[str] = None, page: int = 1, limit: int = 10,
):
    filt: dict = {"userId": x_user_id}
    if status:
        filt["status"] = status
    skip  = (page - 1) * limit
    docs  = await bookings_col.find(filt).sort("createdAt", -1).skip(skip).limit(limit).to_list(None)
    total = await bookings_col.count_documents(filt)
    return {"bookings": [_fix(d) for d in docs], "total": total}


@app.post("/api/parking/bookings", status_code=201)
async def create_booking(body: BookingBody, x_user_id: Optional[str] = Header(None)):
    slot = await slots_col.find_one({"_id": ObjectId(body.slotId)})
    if not slot:
        raise HTTPException(404, "Parking slot not found")
    if slot.get("availableSlots", 0) <= 0:
        raise HTTPException(400, "No available slots at this location")

    start    = datetime.fromisoformat(body.startTime.replace("Z", "+00:00"))
    end      = datetime.fromisoformat(body.endTime.replace("Z", "+00:00"))
    duration = max(1, math.ceil((end - start).total_seconds() / 3600))
    amount   = duration * slot["pricePerHour"]
    otp      = str(random.randint(100000, 999999))
    bid      = uuid.uuid4().hex[:8].upper()

    booking_doc = {
        "bookingId":     bid,
        "userId":        x_user_id,
        "userName":      body.userName,
        "slotId":        str(slot["_id"]),
        "slotName":      slot["name"],
        "slotCode":      slot["slotCode"],
        "slotAddress":   slot["address"],
        "vehicleNumber": body.vehicleNumber,
        "vehicleType":   body.vehicleType,
        "startTime":     start,
        "endTime":       end,
        "duration":      duration,
        "totalAmount":   amount,
        "status":        "confirmed",
        "qrData":        f"SMARTPARK|{slot['slotCode']}|{int(datetime.now().timestamp()*1000)}",
        "otp":           otp,
        "checkedIn":     False,
        "checkedOut":    False,
        "paymentStatus": "paid",
        "createdAt":     datetime.now(timezone.utc),
    }
    result = await bookings_col.insert_one(booking_doc)

    new_available = slot["availableSlots"] - 1
    new_reserved  = slot.get("reservedSlots", 0) + 1
    new_status    = "occupied" if new_available == 0 else "reserved"
    await slots_col.update_one(
        {"_id": slot["_id"]},
        {"$set": {"availableSlots": new_available, "reservedSlots": new_reserved, "status": new_status}},
    )

    await _notify({
        "userId": x_user_id, "type": "booking_confirmed", "priority": "high",
        "title": "Booking Confirmed!",
        "message": f"Your slot at {slot['name']} is reserved. OTP: {otp}. Amount: ₹{amount}",
        "data": {"bookingId": bid},
    })

    booking_doc["_id"] = result.inserted_id
    return _fix(booking_doc)


@app.put("/api/parking/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, x_user_id: Optional[str] = Header(None)):
    booking = await bookings_col.find_one({"_id": ObjectId(booking_id), "userId": x_user_id})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["status"] in ("completed", "cancelled"):
        raise HTTPException(400, "Cannot cancel this booking")

    await bookings_col.update_one({"_id": booking["_id"]}, {"$set": {"status": "cancelled"}})
    await slots_col.update_one(
        {"_id": ObjectId(booking["slotId"])},
        {"$inc": {"availableSlots": 1, "reservedSlots": -1}},
    )

    await _notify({
        "userId": x_user_id, "type": "booking_cancelled", "priority": "medium",
        "title": "Booking Cancelled",
        "message": f"Your booking at {booking['slotName']} has been cancelled. Refund initiated.",
        "data": {"bookingId": booking["bookingId"]},
    })
    updated = await bookings_col.find_one({"_id": booking["_id"]})
    return {"message": "Booking cancelled", "booking": _fix(updated)}


@app.post("/api/parking/bookings/{booking_id}/checkin")
async def check_in(booking_id: str, body: CheckInBody):
    booking = await bookings_col.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.get("otp") != body.otp:
        raise HTTPException(400, "Invalid OTP. Please try again.")
    if booking.get("checkedIn"):
        raise HTTPException(400, "Already checked in")
    await bookings_col.update_one(
        {"_id": booking["_id"]},
        {"$set": {"checkedIn": True, "checkedInAt": datetime.now(timezone.utc), "status": "active"}},
    )
    updated = await bookings_col.find_one({"_id": booking["_id"]})
    return {"message": "Check-in successful! Enjoy your parking.", "booking": _fix(updated)}


@app.post("/api/parking/bookings/{booking_id}/checkout")
async def check_out(booking_id: str):
    booking = await bookings_col.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if not booking.get("checkedIn"):
        raise HTTPException(400, "Not checked in yet")
    await bookings_col.update_one(
        {"_id": booking["_id"]},
        {"$set": {"checkedOut": True, "checkedOutAt": datetime.now(timezone.utc), "status": "completed"}},
    )
    await slots_col.update_one(
        {"_id": ObjectId(booking["slotId"])},
        {"$inc": {"availableSlots": 1, "reservedSlots": -1}},
    )
    updated = await bookings_col.find_one({"_id": booking["_id"]})
    return {"message": "Check-out successful!", "booking": _fix(updated)}


@app.get("/health")
async def health():
    return {"status": "Parking Service Running", "port": PORT}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
