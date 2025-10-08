#!/bin/zsh

# Start the backend server in the background
echo "Starting backend server..."
cd server && npm run dev &
SERVER_PID=$!

# Wait a bit for the server to start
sleep 3

# Start the frontend
echo "Starting frontend..."
cd ..
npm run dev

# Cleanup on exit
trap "kill $SERVER_PID" EXIT
