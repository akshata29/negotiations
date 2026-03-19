@echo off
echo ============================================================
echo  McLane Autonomous Negotiations — Backend Setup
echo ============================================================
cd /d "%~dp0\backend"

echo [1/3] Creating Python virtual environment...
python -m venv .venv
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.11+
    pause & exit /b 1
)

echo [2/3] Activating .venv and installing dependencies...
call .venv\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install -r requirements.txt

echo [3/3] Setup complete!
echo.
echo Virtual environment: backend\.venv
echo Run the backend:     run_backend.bat
pause
