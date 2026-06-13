#!/bin/bash
# Move to the directory where this script is located
cd "$(dirname "$0")"

echo "Stopping any existing Fintrack server..."
# Kill any process running on port 8000 (standard server port)
fuser -k 8000/tcp 2>/dev/null || true
sleep 1

# Open the app in the default browser in the background (after a brief delay)
(
    sleep 1.5
    if command -v xdg-open > /dev/null; then
        xdg-open http://localhost:8000 > /dev/null 2>&1
    else
        echo "Please open http://localhost:8000 in your browser."
    fi
) &

# Start the python server in the FOREGROUND so it receives Ctrl+C
python3 server.py
