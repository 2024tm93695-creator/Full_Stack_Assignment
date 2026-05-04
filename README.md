# Smart Traffic Parking System

A full-stack microservices application for real-time smart parking and traffic management. Built with Node.js, React, MongoDB, and Docker.

---

## Architecture

```
                        ┌─────────────────┐
                        │    Frontend      │
                        │  React (: 3000)  │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │   API Gateway   │
                        │  Express (:5000) │
                        │  JWT · Rate Limit│
                        └──┬──┬──┬──┬────┘
                           │  │  │  │
          ┌────────────────┘  │  │  └──────────────────┐
          │              ┌────┘  └────┐                 │
          ▼              ▼            ▼                  ▼
   ┌─────────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────────┐
   │ Auth Service│ │ Parking  │ │ Traffic │ │  Notification    │
   │   (:5001)   │ │ Service  │ │ Service │ │    Service       │
   │             │ │ (:5002)  │ │ (:5003) │ │    (:5004)       │
   └──────┬──────┘ └────┬─────┘ └────┬────┘ └────────┬─────────┘
          │              │            │                 │
          └──────────────┴────────────┴─────────────────┘
                                     │
                            ┌────────▼────────┐
                            │    MongoDB       │
                            │    (:27017)      │
                            └─────────────────┘
```

---

## Features

- **Authentication** — JWT-based register/login, role-based access (user/admin)
- **Parking Management** — Real-time slot availability, geolocation-based nearby search, bookings with QR codes, check-in/check-out
- **Traffic Monitoring** — Live traffic data streaming via WebSocket, heatmaps, ETA calculations, IoT simulator
- **Notifications** — Real-time push notifications via Socket.io with per-user rooms
- **Admin Dashboard** — Occupancy stats, booking analytics, charts (Recharts)
- **Interactive Map** — Leaflet map with parking slot overlays and traffic data

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Leaflet, Socket.io-client, Recharts |
| API Gateway | Node.js, Express, http-proxy-middleware, express-rate-limit |
| Backend Services | Node.js, Express, Mongoose, Socket.io, JWT, bcryptjs |
| Database | MongoDB 7 |
| Infrastructure | Docker, Docker Compose |

---

## Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose **or** Node.js 18+ and MongoDB 7

---

## Quick Start (Docker)

```bash
# Clone the repository
git clone <repo-url>
cd smart-traffic-parking

# Copy environment file
cp .env.example .env

# Build and start all services
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API Gateway | http://localhost:5000 |
| API Docs (Swagger) | http://localhost:5000/api-docs |
| Mongo Express (DB UI) | http://localhost:8081 |

Mongo Express credentials: `admin` / `admin123`

---

## Manual Setup (without Docker)

Requires MongoDB running locally on port 27017.

```bash
cp .env.example .env
```

Start each service in a separate terminal:

```bash
# Auth Service
cd services/auth-service && npm install && npm start

# Parking Service
cd services/parking-service && npm install && npm start

# Traffic Service
cd services/traffic-service && npm install && npm start

# Notification Service
cd services/notification-service && npm install && npm start

# API Gateway
cd api-gateway && npm install && npm start

# Frontend
cd frontend && npm install && npm start
```

Or use the provided scripts:

```bash
# Windows
start.bat

# Linux / macOS
chmod +x start.sh && ./start.sh
```

---

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017/smart_traffic_parking` | MongoDB connection string |
| `JWT_SECRET` | `smartpark_jwt_secret_2024` | JWT signing secret |
| `AUTH_SERVICE_PORT` | `5001` | Auth service port |
| `PARKING_SERVICE_PORT` | `5002` | Parking service port |
| `TRAFFIC_SERVICE_PORT` | `5003` | Traffic service port |
| `NOTIFICATION_SERVICE_PORT` | `5004` | Notification service port |
| `REACT_APP_API_URL` | `http://localhost:5000` | Frontend → API Gateway URL |
| `REACT_APP_TRAFFIC_WS` | `http://localhost:5003` | Frontend → Traffic WebSocket URL |
| `REACT_APP_NOTIF_WS` | `http://localhost:5004` | Frontend → Notification WebSocket URL |

---

## API Reference

All requests go through the API Gateway at `http://localhost:5000`. Protected routes require `Authorization: Bearer <token>`.

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | No | Register a new user |
| POST | `/login` | No | Login, returns JWT |
| GET | `/profile` | Yes | Get current user profile |
| PUT | `/profile` | Yes | Update user profile |
| GET | `/users` | Admin | List all users |

### Parking (`/api/parking`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/slots` | No | List all parking slots |
| GET | `/slots/nearby` | No | Nearby slots by geolocation |
| GET | `/slots/stats` | No | Occupancy statistics |
| POST | `/slots` | Admin | Create a parking slot |
| PUT | `/slots/:id` | Admin | Update a parking slot |
| DELETE | `/slots/:id` | Admin | Delete a parking slot |
| POST | `/bookings` | Yes | Create a booking |
| GET | `/bookings` | Yes | Get user's bookings |
| PUT | `/bookings/:id/cancel` | Yes | Cancel a booking |
| POST | `/bookings/:id/checkin` | Yes | Check in to a booking |
| POST | `/bookings/:id/checkout` | Yes | Check out from a booking |
| GET | `/bookings/stats` | Admin | Booking statistics |

### Traffic (`/api/traffic`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | No | All traffic data |
| GET | `/stats` | No | Traffic statistics |
| GET | `/heatmap` | No | Traffic heatmap data |
| GET | `/eta` | No | ETA calculations |
| GET | `/nearby` | No | Nearby traffic data |

WebSocket: connect to `http://localhost:5003` for live traffic stream.

### Notifications (`/api/notifications`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | Get user's notifications |
| POST | `/` | Yes | Create a notification |
| PUT | `/:id/read` | Yes | Mark notification as read |
| PUT | `/read-all` | Yes | Mark all notifications as read |
| DELETE | `/:id` | Yes | Delete a notification |

WebSocket: connect to `http://localhost:5004`, join room `user:{userId}` for real-time delivery.

### Health Check

```
GET http://localhost:5000/health
```

Returns the status and URLs of all downstream services.

---

## Project Structure

```
smart-traffic-parking/
├── api-gateway/              # Express reverse proxy + JWT guard
├── services/
│   ├── auth-service/         # User registration, login, JWT
│   ├── parking-service/      # Slots, bookings, geolocation
│   ├── traffic-service/      # Live traffic data, WebSocket, IoT sim
│   └── notification-service/ # Real-time notifications, WebSocket
├── frontend/                 # React SPA
├── docker-compose.yml
├── .env.example
├── start.bat                 # Windows startup script
└── start.sh                  # Linux/macOS startup script
```

---

## License

MIT
