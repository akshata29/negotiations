@echo off
echo ============================================================
echo  McLane Autonomous Negotiations — Full Stack
echo ============================================================
echo Starting Backend (port 8000) and Frontend (port 5173)...
echo.
start "Backend API" cmd /k "run_backend.bat"
timeout /t 3 /nobreak > nul
start "Frontend UI" cmd /k "run_frontend.bat"
echo.
echo Both services starting...
echo Backend: http://localhost:8000/docs
echo Frontend: http://localhost:5173
echo.
pause
