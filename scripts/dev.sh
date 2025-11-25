#!/bin/bash
# Development Startup Script (Unix/Mac/Linux)
# Starts both AlertGrid frontend and DataGrid workers

echo "════════════════════════════════════════════════════════════"
echo "🚀 Somnia DataGrid - Development Mode"
echo "   DataGrid (workers) + AlertGrid (frontend)"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if .env files exist
if [ ! -f "frontend/.env" ]; then
    echo "⚠️  frontend/.env not found. Copy from frontend/.env.example"
fi
if [ ! -f "workers/.env" ]; then
    echo "⚠️  workers/.env not found. Copy from workers/.env.example"
fi

echo ""
echo "Starting services..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $NEXT_PID 2>/dev/null
    kill $WORKER_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Next.js
echo "📱 Starting AlertGrid frontend..."
cd frontend && npm run dev &
NEXT_PID=$!
cd ..

# Wait for Next.js to start
sleep 3

# Start Workers
echo "⚙️  Starting DataGrid workers..."
cd workers && npm run dev &
WORKER_PID=$!
cd ..

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Services started!"
echo ""
echo "AlertGrid:  http://localhost:3000"
echo "DataGrid:   Workers running in background"
echo ""
echo "Press Ctrl+C to stop all services"
echo "════════════════════════════════════════════════════════════"

# Wait for both processes
wait
