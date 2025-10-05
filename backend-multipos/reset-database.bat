@echo off
echo 🔄 Database Reset Script
echo =======================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the backend-multipos directory
    echo    Current directory: %CD%
    echo    Expected: multipos/backend-multipos/
    pause
    exit /b 1
)

echo 📁 Current directory: %CD%
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    echo.
)

REM Check if scripts directory exists
if not exist "scripts" (
    echo 📁 Creating scripts directory...
    mkdir scripts
    echo.
)

echo 🚀 Running database reset...
echo.

REM Run the reset script
node scripts/reset-database.js

echo.
echo ✅ Database reset script completed!
echo.
echo 🔑 You can now login with:
echo    Email: shahjahan@multipos.com
echo    Password: Shahjahan@123
echo    Role: ADMIN
echo.
pause
