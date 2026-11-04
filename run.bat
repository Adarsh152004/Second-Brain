@echo off
echo ===================================================
echo   Starting Second Brain AI Agent (Full Stack)
echo ===================================================
cd /d "%~dp0"

echo [1/2] Starting Python FastAPI Backend on port 8000...
start "Second Brain - Backend (Port 8000)" .venv\Scripts\python.exe -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

echo [2/2] Starting Next.js Frontend on port 3000...
cd frontend
start "Second Brain - Frontend (Port 3000)" cmd /c "npm run dev"

echo.
echo All services launched!
echo Access the application at: http://localhost:3000
echo Backend API Documentation: http://localhost:8000/docs
echo ===================================================
