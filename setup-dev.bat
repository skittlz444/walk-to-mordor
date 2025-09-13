@echo off

REM Walk to Mordor - Development Setup Script

echo 🗻 Setting up Walk to Mordor development environment...

REM Check if .dev.vars exists
if not exist ".dev.vars" (
    echo 📝 Creating development environment file...
    
    REM Copy the example file
    copy ".dev.vars.example" ".dev.vars" >nul
    
    echo ⚠️  Please edit .dev.vars and replace 'your-d1-database-id-here' with your actual D1 database ID
    echo    You can get your database ID by running: npx wrangler d1 create walk-to-mordor
    echo.
    echo 📖 Then run 'npm run dev' to start the development server
) else (
    echo ✅ Development environment file already exists
    echo 🚀 You can run 'npm run dev' to start the development server
)

echo.
echo 📚 For more information, see README.md
pause
