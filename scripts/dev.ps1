# Development Startup Script (Windows PowerShell)
# Starts both AlertGrid frontend and DataGrid workers

Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host "🚀 Somnia DataGrid - Development Mode" -ForegroundColor Cyan
Write-Host "   DataGrid (workers) + AlertGrid (frontend)" -ForegroundColor Gray
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host ""

# Check if .env files exist
if (-not (Test-Path "frontend/.env")) {
    Write-Host "⚠️  frontend/.env not found. Copy from frontend/.env.example" -ForegroundColor Yellow
}
if (-not (Test-Path "workers/.env")) {
    Write-Host "⚠️  workers/.env not found. Copy from workers/.env.example" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting services..." -ForegroundColor Green
Write-Host ""

# Start Next.js in a new terminal
Write-Host "📱 Starting AlertGrid frontend..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

# Wait a bit for Next.js to start
Start-Sleep -Seconds 3

# Start Workers in a new terminal
Write-Host "⚙️  Starting DataGrid workers..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd workers; npm run dev"

Write-Host ""
Write-Host "═" * 60 -ForegroundColor Green
Write-Host "✅ Services started!" -ForegroundColor Green
Write-Host ""
Write-Host "AlertGrid:  http://localhost:3000" -ForegroundColor White
Write-Host "DataGrid:   Workers running in background" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in each terminal to stop" -ForegroundColor Gray
Write-Host "═" * 60 -ForegroundColor Green
