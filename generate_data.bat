@echo off
echo ============================================================
echo  McLane Autonomous Negotiations — Generate Synthetic Data
echo ============================================================
cd /d "%~dp0\backend"

if not exist ".venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found. Run setup_venv.bat first.
    pause & exit /b 1
)

call .venv\Scripts\activate.bat
echo Generating 2000 synthetic vendors and loading to Cosmos DB...
echo (This requires active Azure credentials - AZURE_CLIENT_ID/SECRET/TENANT_ID in .env)
echo.
python -m scripts.generate_synthetic_data
echo.
echo Done! Check Cosmos DB for data.
pause
