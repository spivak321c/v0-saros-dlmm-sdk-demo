#!/bin/bash
set -e

# Install dependencies
pnpm install

# Build frontend
pnpm run build

# Build backend
cd server
pnpm install
pnpm run build

if [ ! -f "dist/index.js" ]; then
  echo "Error: Backend build failed - dist/index.js not found"
  exit 1
fi

cd ..

# Start backend server (serves both API and frontend static files)
cd server
node dist/index.js
