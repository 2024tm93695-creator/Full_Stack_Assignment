@echo off
echo ============================================
echo   SmartPark - Smart Traffic ^& Parking
echo   Starting all services...
echo ============================================

REM Copy .env to each service directory
copy .env.example .env 2>nul
copy .env services\auth-service\.env 2>nul
copy .env services\parking-service\.env 2>nul
copy .env services\traffic-service\.env 2>nul
copy .env services\notification-service\.env 2>nul
copy .env api-gateway\.env 2>nul

echo Installing dependencies...

cd api-gateway && npm install && cd ..
cd services\auth-service && npm install && cd ..\..
cd services\parking-service && npm install && cd ..\..
cd services\traffic-service && npm install && cd ..\..
cd services\notification-service && npm install && cd ..\..
cd frontend && npm install && cd ..

echo.
echo Starting services in separate windows...

start "API Gateway   :5000" cmd /k "cd api-gateway && npm run dev"
timeout /t 2 >nul
start "Auth Service  :5001" cmd /k "cd services\auth-service && npm run dev"
timeout /t 2 >nul
start "Parking Svc   :5002" cmd /k "cd services\parking-service && npm run dev"
timeout /t 2 >nul
start "Traffic Svc   :5003" cmd /k "cd services\traffic-service && npm run dev"
timeout /t 2 >nul
start "Notif Service :5004" cmd /k "cd services\notification-service && npm run dev"
timeout /t 3 >nul

echo.
echo Seeding parking data...
cd services\parking-service && node src/seed/seedData.js && cd ..\..

echo.
echo Starting React frontend...
start "Frontend      :3000" cmd /k "cd frontend && npm start"

echo.
echo ============================================
echo   All services started!
echo   Frontend:   http://localhost:3000
echo   API Gateway: http://localhost:5000
echo ============================================
pause
