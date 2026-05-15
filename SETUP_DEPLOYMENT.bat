@echo off
REM CTU System - Pre-Deployment Setup Script
REM Run this before pushing to GitHub/Railway

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     CTU SYSTEM - PRE-DEPLOYMENT SETUP SCRIPT               ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is not installed!
    echo    Visit: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js installed: 
node -v

REM Check if npm is installed
npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: npm is not installed!
    pause
    exit /b 1
)
echo ✅ npm installed: 
npm -v

REM Check if package.json exists
if not exist "package.json" (
    echo ❌ ERROR: package.json not found!
    echo    Make sure you're in the project directory
    pause
    exit /b 1
)
echo ✅ package.json found

REM Check node_modules
if not exist "node_modules" (
    echo.
    echo 📦 Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ Error installing dependencies!
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed
) else (
    echo ✅ node_modules already exists
)

REM Check if server.js exists
if not exist "server.js" (
    echo ❌ ERROR: server.js not found!
    pause
    exit /b 1
)
echo ✅ server.js found

REM Check if database directory exists
if not exist "database" (
    echo ⚠️  WARNING: database directory not found
) else (
    echo ✅ database directory found
)

REM Check if html directory exists
if not exist "html" (
    echo ⚠️  WARNING: html directory not found
) else (
    echo ✅ html directory found
)

REM Check deployment files
echo.
echo 📋 Checking deployment files:

if not exist ".env.example" (
    echo ⚠️  .env.example not found
) else (
    echo ✅ .env.example exists
)

if not exist "railway.json" (
    echo ⚠️  railway.json not found
) else (
    echo ✅ railway.json exists
)

if not exist "RAILWAY_DEPLOYMENT_GUIDE.md" (
    echo ⚠️  RAILWAY_DEPLOYMENT_GUIDE.md not found
) else (
    echo ✅ RAILWAY_DEPLOYMENT_GUIDE.md exists
)

REM Final summary
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║              SETUP COMPLETE! ✅                           ║
echo ╠════════════════════════════════════════════════════════════╣
echo ║ Your system is ready for deployment!                       ║
echo ║                                                            ║
echo ║ NEXT STEPS:                                                ║
echo ║ 1. Change admin password in server.js (NOT admin123)      ║
echo ║ 2. Commit to GitHub: git push                             ║
echo ║ 3. Deploy to Railway (follow RAILWAY_DEPLOYMENT_GUIDE)    ║
echo ║ 4. Test everything works                                   ║
echo ║                                                            ║
echo ║ Questions? Check DEPLOYMENT_CHECKLIST.md                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

pause
