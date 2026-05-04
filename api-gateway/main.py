import os
import time
from collections import defaultdict

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt

load_dotenv()

PORT            = int(os.getenv("PORT", 5000))
AUTH_SERVICE    = os.getenv("AUTH_SERVICE_URL",    "http://localhost:5001")
PARKING_SERVICE = os.getenv("PARKING_SERVICE_URL", "http://localhost:5002")
TRAFFIC_SERVICE = os.getenv("TRAFFIC_SERVICE_URL", "http://localhost:5003")
NOTIF_SERVICE   = os.getenv("NOTIF_SERVICE_URL",   "http://localhost:5004")
JWT_SECRET      = os.getenv("JWT_SECRET", "smartpark_jwt_secret_2024")
FRONTEND_URL    = os.getenv("FRONTEND_URL", "http://localhost:3000")

app = FastAPI(
    title="SmartPark — Smart Traffic & Parking API",
    description="Complete API for Smart Traffic & Parking Management System. Use `/api/auth/login` to get a JWT token, then click **Authorize** above.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Custom OpenAPI schema with full endpoint docs ─────────────────────────────
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    app.openapi_schema = {
        "openapi": "3.0.0",
        "info": {
            "title": "SmartPark — Smart Traffic & Parking API",
            "version": "1.0.0",
            "description": "All requests go through the API Gateway on port 5000. Use `/api/auth/login` to get a JWT token, then click **Authorize**.",
        },
        "servers": [{"url": "http://localhost:5000", "description": "API Gateway"}],
        "components": {
            "securitySchemes": {
                "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
            },
            "schemas": {
                "AuthResponse": {"type": "object", "properties": {"token": {"type": "string"}, "user": {"type": "object"}}},
                "ParkingSlot": {"type": "object", "properties": {
                    "_id": {"type": "string"}, "name": {"type": "string"}, "area": {"type": "string"},
                    "address": {"type": "string"}, "totalSlots": {"type": "integer"},
                    "availableSlots": {"type": "integer"}, "pricePerHour": {"type": "number"},
                    "status": {"type": "string", "enum": ["available", "occupied", "reserved", "closed"]},
                    "vehicleTypes": {"type": "array", "items": {"type": "string"}},
                    "rating": {"type": "number"}, "isOperational": {"type": "boolean"}
                }},
                "Booking": {"type": "object", "properties": {
                    "_id": {"type": "string"}, "bookingId": {"type": "string"},
                    "slotName": {"type": "string"}, "vehicleNumber": {"type": "string"},
                    "startTime": {"type": "string", "format": "date-time"},
                    "endTime": {"type": "string", "format": "date-time"},
                    "duration": {"type": "integer"}, "totalAmount": {"type": "number"},
                    "status": {"type": "string", "enum": ["confirmed", "active", "completed", "cancelled"]},
                    "otp": {"type": "string"}, "checkedIn": {"type": "boolean"}
                }},
                "TrafficData": {"type": "object", "properties": {
                    "roadName": {"type": "string"}, "area": {"type": "string"},
                    "congestionLevel": {"type": "string", "enum": ["free", "moderate", "heavy", "severe"]},
                    "congestionScore": {"type": "integer"}, "averageSpeed": {"type": "number"},
                    "vehicleCount": {"type": "integer"}, "incidentType": {"type": "string"}
                }},
                "Error": {"type": "object", "properties": {"error": {"type": "string"}}}
            }
        },
        "paths": {
            # AUTH
            "/api/auth/register": {"post": {"tags": ["Auth"], "summary": "Register a new user", "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "required": ["name", "email", "password"], "properties": {"name": {"type": "string", "example": "Priya Sharma"}, "email": {"type": "string", "example": "priya@example.com"}, "password": {"type": "string", "example": "pass1234"}, "phone": {"type": "string"}, "vehicleNumber": {"type": "string", "example": "TS09AB1234"}, "vehicleType": {"type": "string", "example": "car"}}}}}}, "responses": {"201": {"description": "Registered — returns token + user"}, "400": {"description": "Email already exists"}}}},
            "/api/auth/login": {"post": {"tags": ["Auth"], "summary": "Login — returns JWT token", "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "required": ["email", "password"], "properties": {"email": {"type": "string", "example": "user@demo.com"}, "password": {"type": "string", "example": "demo123"}}}}}}, "responses": {"200": {"description": "Login successful", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/AuthResponse"}}}}, "401": {"description": "Invalid credentials"}}}},
            "/api/auth/profile": {
                "get": {"tags": ["Auth"], "summary": "Get logged-in user profile", "security": [{"bearerAuth": []}], "responses": {"200": {"description": "User profile"}, "401": {"description": "Unauthorized"}}},
                "put": {"tags": ["Auth"], "summary": "Update user profile", "security": [{"bearerAuth": []}], "requestBody": {"content": {"application/json": {"schema": {"type": "object", "properties": {"name": {"type": "string"}, "phone": {"type": "string"}, "vehicleNumber": {"type": "string"}, "vehicleType": {"type": "string"}}}}}}, "responses": {"200": {"description": "Profile updated"}, "401": {"description": "Unauthorized"}}}
            },
            "/api/auth/users": {"get": {"tags": ["Auth"], "summary": "Get all users (Admin only)", "security": [{"bearerAuth": []}], "responses": {"200": {"description": "List of all users"}, "403": {"description": "Admin access required"}}}},
            # PARKING SLOTS
            "/api/parking/slots": {
                "get": {"tags": ["Parking Slots"], "summary": "Get all parking slots", "parameters": [{"name": "area", "in": "query", "schema": {"type": "string"}}, {"name": "vehicleType", "in": "query", "schema": {"type": "string", "enum": ["car", "bike", "truck"]}}, {"name": "status", "in": "query", "schema": {"type": "string"}}, {"name": "maxPrice", "in": "query", "schema": {"type": "number"}}, {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20}}], "responses": {"200": {"description": "Paginated list of slots"}}},
                "post": {"tags": ["Parking Slots"], "summary": "Create a new parking slot (Admin)", "security": [{"bearerAuth": []}], "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "required": ["name", "area", "address", "totalSlots", "pricePerHour"], "properties": {"name": {"type": "string", "example": "HITEC City Parking A"}, "area": {"type": "string", "example": "HITEC City"}, "address": {"type": "string"}, "totalSlots": {"type": "integer", "example": 100}, "pricePerHour": {"type": "number", "example": 30}, "vehicleTypes": {"type": "array", "items": {"type": "string"}, "example": ["car", "bike"]}}}}}}, "responses": {"201": {"description": "Slot created"}}}
            },
            "/api/parking/slots/stats": {"get": {"tags": ["Parking Slots"], "summary": "Get parking stats (total, available, locations)", "responses": {"200": {"description": "Slot statistics"}}}},
            "/api/parking/slots/nearby": {"get": {"tags": ["Parking Slots"], "summary": "Get nearby slots by GPS coordinates", "parameters": [{"name": "lat", "in": "query", "required": True, "schema": {"type": "number"}, "example": 17.4435}, {"name": "lng", "in": "query", "required": True, "schema": {"type": "number"}, "example": 78.3733}, {"name": "radius", "in": "query", "schema": {"type": "integer", "default": 5000}}], "responses": {"200": {"description": "Nearby parking slots"}}}},
            "/api/parking/slots/{id}": {
                "get": {"tags": ["Parking Slots"], "summary": "Get parking slot by ID", "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string"}}], "responses": {"200": {"description": "Slot details"}, "404": {"description": "Not found"}}},
                "put": {"tags": ["Parking Slots"], "summary": "Update slot (Admin) — use isOperational to enable/disable", "security": [{"bearerAuth": []}], "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string"}}], "requestBody": {"content": {"application/json": {"schema": {"type": "object", "properties": {"isOperational": {"type": "boolean"}, "pricePerHour": {"type": "number"}, "status": {"type": "string"}}}}}}, "responses": {"200": {"description": "Slot updated"}}},
                "delete": {"tags": ["Parking Slots"], "summary": "Delete a parking slot (Admin)", "security": [{"bearerAuth": []}], "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string"}}], "responses": {"200": {"description": "Slot deleted"}}}
            },
            # BOOKINGS
            "/api/parking/bookings": {
                "get": {"tags": ["Bookings"], "summary": "Get my bookings", "security": [{"bearerAuth": []}], "parameters": [{"name": "status", "in": "query", "schema": {"type": "string", "enum": ["confirmed", "active", "completed", "cancelled"]}}, {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 10}}], "responses": {"200": {"description": "User bookings"}}},
                "post": {"tags": ["Bookings"], "summary": "Create a booking", "security": [{"bearerAuth": []}], "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "required": ["slotId", "vehicleNumber", "vehicleType", "startTime", "endTime"], "properties": {"slotId": {"type": "string"}, "vehicleNumber": {"type": "string", "example": "TS09AB1234"}, "vehicleType": {"type": "string", "example": "car"}, "startTime": {"type": "string", "format": "date-time", "example": "2026-05-04T10:00:00"}, "endTime": {"type": "string", "format": "date-time", "example": "2026-05-04T12:00:00"}, "userName": {"type": "string"}}}}}}, "responses": {"201": {"description": "Booking confirmed with OTP"}, "400": {"description": "No available slots"}}}
            },
            "/api/parking/bookings/all": {"get": {"tags": ["Bookings"], "summary": "Get all bookings system-wide (Admin)", "security": [{"bearerAuth": []}], "parameters": [{"name": "status", "in": "query", "schema": {"type": "string"}}, {"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20}}], "responses": {"200": {"description": "All bookings"}}}},
            "/api/parking/bookings/stats": {"get": {"tags": ["Bookings"], "summary": "Get booking stats and revenue (Admin)", "security": [{"bearerAuth": []}], "responses": {"200": {"description": "Booking statistics and revenue"}}}},
            "/api/parking/bookings/{id}/cancel": {"put": {"tags": ["Bookings"], "summary": "Cancel a booking", "security": [{"bearerAuth": []}], "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string"}}], "responses": {"200": {"description": "Booking cancelled"}, "400": {"description": "Cannot cancel"}}}},
            "/api/parking/bookings/{id}/checkin": {"post": {"tags": ["Bookings"], "summary": "Check in using OTP", "security": [{"bearerAuth": []}], "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string"}}], "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "required": ["otp"], "properties": {"otp": {"type": "string", "example": "472913"}}}}}}, "responses": {"200": {"description": "Checked in — status becomes active"}, "400": {"description": "Invalid OTP"}}}},
            "/api/parking/bookings/{id}/checkout": {"post": {"tags": ["Bookings"], "summary": "Check out — frees the slot", "security": [{"bearerAuth": []}], "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string"}}], "responses": {"200": {"description": "Checked out — status becomes completed"}}}},
            # TRAFFIC
            "/api/traffic": {"get": {"tags": ["Traffic"], "summary": "Get latest traffic data for all roads", "parameters": [{"name": "area", "in": "query", "schema": {"type": "string"}}, {"name": "congestion", "in": "query", "schema": {"type": "string", "enum": ["free", "moderate", "heavy", "severe"]}}], "responses": {"200": {"description": "Live traffic data"}}}},
            "/api/traffic/stats": {"get": {"tags": ["Traffic"], "summary": "Get congestion level counts", "responses": {"200": {"description": "Stats by congestion level"}}}},
            "/api/traffic/nearby": {"get": {"tags": ["Traffic"], "summary": "Get traffic near GPS coordinates", "parameters": [{"name": "lat", "in": "query", "required": True, "schema": {"type": "number"}, "example": 17.4435}, {"name": "lng", "in": "query", "required": True, "schema": {"type": "number"}, "example": 78.3733}, {"name": "radius", "in": "query", "schema": {"type": "integer", "default": 4000}}], "responses": {"200": {"description": "Nearby traffic readings"}}}},
            "/api/traffic/eta": {"get": {"tags": ["Traffic"], "summary": "Estimate travel time between two points", "parameters": [{"name": "fromLat", "in": "query", "required": True, "schema": {"type": "number"}, "example": 17.4435}, {"name": "fromLng", "in": "query", "required": True, "schema": {"type": "number"}, "example": 78.3733}, {"name": "toLat", "in": "query", "required": True, "schema": {"type": "number"}, "example": 17.385}, {"name": "toLng", "in": "query", "required": True, "schema": {"type": "number"}, "example": 78.4867}], "responses": {"200": {"description": "ETA estimate with congestion score"}}}},
            "/api/traffic/heatmap": {"get": {"tags": ["Traffic"], "summary": "Get heatmap data for all roads", "responses": {"200": {"description": "Heatmap points with lat/lng/intensity"}}}},
            # NOTIFICATIONS
            "/api/notifications": {
                "get": {"tags": ["Notifications"], "summary": "Get my notifications", "security": [{"bearerAuth": []}], "parameters": [{"name": "limit", "in": "query", "schema": {"type": "integer", "default": 20}}], "responses": {"200": {"description": "Notifications with unread count"}}},
                "post": {"tags": ["Notifications"], "summary": "Create a notification (internal use)", "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "required": ["userId", "title", "message", "type"], "properties": {"userId": {"type": "string"}, "title": {"type": "string", "example": "Booking Confirmed!"}, "message": {"type": "string"}, "type": {"type": "string", "example": "booking_confirmed"}, "priority": {"type": "string", "example": "high"}}}}}}, "responses": {"201": {"description": "Notification sent via WebSocket"}}}
            },
            "/api/notifications/read-all": {"put": {"tags": ["Notifications"], "summary": "Mark all notifications as read", "security": [{"bearerAuth": []}], "responses": {"200": {"description": "All marked as read"}}}},
            "/api/notifications/{id}/read": {"put": {"tags": ["Notifications"], "summary": "Mark one notification as read", "security": [{"bearerAuth": []}], "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string"}}], "responses": {"200": {"description": "Marked as read"}}}},
            "/api/notifications/{id}": {"delete": {"tags": ["Notifications"], "summary": "Delete a notification", "security": [{"bearerAuth": []}], "parameters": [{"name": "id", "in": "path", "required": True, "schema": {"type": "string"}}], "responses": {"200": {"description": "Deleted"}}}}
        }
    }
    return app.openapi_schema

app.openapi = custom_openapi

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiter (300 req / 15 min per IP) ────────────────────────────────────
_rate_store: dict[str, list] = defaultdict(list)

def _rate_ok(ip: str) -> bool:
    now    = time.time()
    window = 15 * 60
    _rate_store[ip] = [t for t in _rate_store[ip] if now - t < window]
    if len(_rate_store[ip]) >= 300:
        return False
    _rate_store[ip].append(now)
    return True

# ── JWT verification ──────────────────────────────────────────────────────────
def _decode_token(request: Request) -> dict:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Access denied. No token provided.")
    try:
        return jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

# ── Generic reverse-proxy helper ─────────────────────────────────────────────
async def _proxy(request: Request, target: str, extra: dict | None = None) -> Response:
    url = target + request.url.path
    if request.url.query:
        url += "?" + request.url.query

    body    = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
    if extra:
        headers.update(extra)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.request(request.method, url, headers=headers, content=body)
        return Response(content=resp.content, status_code=resp.status_code,
                        headers=dict(resp.headers))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Service unavailable: {exc}")

# ── Routes ────────────────────────────────────────────────────────────────────

@app.api_route("/api/auth/{path:path}", methods=["GET","POST","PUT","DELETE","PATCH"])
async def auth_proxy(request: Request):
    if not _rate_ok(request.client.host):
        raise HTTPException(429, "Too many requests.")
    return await _proxy(request, AUTH_SERVICE)


@app.api_route("/api/parking/slots/{path:path}", methods=["GET","POST","PUT","DELETE","PATCH"])
@app.api_route("/api/parking/slots",             methods=["GET","POST","PUT","DELETE","PATCH"])
async def parking_slots_proxy(request: Request):
    if not _rate_ok(request.client.host):
        raise HTTPException(429, "Too many requests.")
    extra = {}
    if request.method != "GET":
        tok   = _decode_token(request)
        extra = {"x-user-id": tok.get("id",""), "x-user-role": tok.get("role","user")}
    return await _proxy(request, PARKING_SERVICE, extra)


@app.api_route("/api/parking/bookings/{path:path}", methods=["GET","POST","PUT","DELETE","PATCH"])
@app.api_route("/api/parking/bookings",             methods=["GET","POST","PUT","DELETE","PATCH"])
async def bookings_proxy(request: Request):
    if not _rate_ok(request.client.host):
        raise HTTPException(429, "Too many requests.")
    tok   = _decode_token(request)
    extra = {"x-user-id": tok.get("id",""), "x-user-role": tok.get("role","user")}
    return await _proxy(request, PARKING_SERVICE, extra)


@app.api_route("/api/traffic/{path:path}", methods=["GET","POST","PUT","DELETE","PATCH"])
@app.api_route("/api/traffic",             methods=["GET"])
async def traffic_proxy(request: Request):
    if not _rate_ok(request.client.host):
        raise HTTPException(429, "Too many requests.")
    return await _proxy(request, TRAFFIC_SERVICE)


@app.api_route("/api/notifications/{path:path}", methods=["GET","POST","PUT","DELETE","PATCH"])
@app.api_route("/api/notifications",             methods=["GET","POST"])
async def notifications_proxy(request: Request):
    if not _rate_ok(request.client.host):
        raise HTTPException(429, "Too many requests.")
    tok   = _decode_token(request)
    extra = {"x-user-id": tok.get("id",""), "x-user-role": tok.get("role","user")}
    return await _proxy(request, NOTIF_SERVICE, extra)


@app.get("/health")
async def health():
    return {
        "status": "API Gateway Running",
        "services": {
            "AUTH_SERVICE":    AUTH_SERVICE,
            "PARKING_SERVICE": PARKING_SERVICE,
            "TRAFFIC_SERVICE": TRAFFIC_SERVICE,
            "NOTIF_SERVICE":   NOTIF_SERVICE,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
