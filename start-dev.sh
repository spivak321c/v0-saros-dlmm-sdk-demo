#!/bin/bash

# Start the backend server in the background
echo "Starting backend server..."
cd server && pnpm run dev &
SERVER_PID=$!

# Wait a bit for the server to start
sleep 3

# Start the frontend
echo "Starting frontend..."
cd ..
pnpm run dev

# Cleanup on exit
trap "kill $SERVER_PID" EXIT
