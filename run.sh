#!/usr/bin/env bash

# Automatically exit on error
set -e

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=============================================="
echo " Starting LinkedIn AI Profile Studio"
echo "=============================================="

# 1. Start Backend
echo "[1/2] Starting Backend (FastAPI)..."
cd "$DIR/linkedin_extension_v2/linkedin_extension/backend"

# Setup virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate venv
source .venv/bin/activate

# Install requirements
echo "Installing Python dependencies..."
pip install -r requirements.txt > /dev/null 2>&1



# Run the backend server
python run.py &
BACKEND_PID=$!
echo "Backend running (PID: $BACKEND_PID)"

# 2. Start Frontend
echo "[2/2] Starting Frontend (React/Vite)..."
cd "$DIR/studio-web"

# Install node modules if not present
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Run the frontend
npm run dev &
FRONTEND_PID=$!
echo "Frontend running (PID: $FRONTEND_PID)"

echo "=============================================="
echo " Both services are starting up!"
echo " - Frontend: http://127.0.0.1:5180/"
echo " - Backend:  http://127.0.0.1:8000/"
echo " Press Ctrl+C to stop all services."
echo "=============================================="

# Trap termination signals and clean up child processes
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo "Services stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Wait for background processes to keep script running
wait
