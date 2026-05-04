#!/bin/bash
set -e

echo "============================================"
echo "  SmartPark - Smart Traffic & Parking"
echo "  Starting all services..."
echo "============================================"

# Copy env to each directory
cp .env.example .env 2>/dev/null || true
for dir in api-gateway services/auth-service services/parking-service services/traffic-service services/notification-service; do
  cp .env $dir/.env 2>/dev/null || true
done

echo "📦 Installing dependencies..."
(cd api-gateway                    && npm install --silent)
(cd services/auth-service          && npm install --silent)
(cd services/parking-service       && npm install --silent)
(cd services/traffic-service       && npm install --silent)
(cd services/notification-service  && npm install --silent)
(cd frontend                       && npm install --silent)

echo "🚀 Starting microservices..."
(cd api-gateway                   && npm run dev &)
sleep 1
(cd services/auth-service         && npm run dev &)
(cd services/parking-service      && npm run dev &)
(cd services/traffic-service      && npm run dev &)
(cd services/notification-service && npm run dev &)
sleep 3

echo "🌱 Seeding parking data..."
(cd services/parking-service && node src/seed/seedData.js)

echo "⚛️  Starting React frontend..."
(cd frontend && npm start &)

echo ""
echo "============================================"
echo "  All services running!"
echo "  Frontend:    http://localhost:3000"
echo "  API Gateway: http://localhost:5000"
echo "  Auth:        http://localhost:5001"
echo "  Parking:     http://localhost:5002"
echo "  Traffic:     http://localhost:5003"
echo "  Notifications: http://localhost:5004"
echo "============================================"

wait
