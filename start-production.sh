#!/bin/bash
set -e

# Install dependencies
npm install

# Build frontend
npm run build

# Build backend
cd server
npm install
npm run build

if [ ! -f "dist/index.js" ]; then
  echo "Error: Backend build failed - dist/index.js not found"
  exit 1
fi

cd ..

# Start backend server (serves both API and frontend static files)
cd server
node dist/index.js
