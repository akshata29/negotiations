@echo off
echo ============================================================
echo  Autonomous Negotiations — Frontend UI
echo ============================================================
cd /d "%~dp0\frontend"

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 18+
    pause & exit /b 1
)

if not exist "node_modules" (
    echo Installing npm packages...
    npm install
)

echo Starting React dev server on http://localhost:5173
echo.
npm run dev
