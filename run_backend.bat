@echo off
echo ============================================================
echo  Autonomous Negotiations — Backend API
echo ============================================================
cd /d "%~dp0\backend"

if not exist ".venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found. Run setup_venv.bat first.
    pause & exit /b 1
)

call .venv\Scripts\activate.bat
echo Starting FastAPI on http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
