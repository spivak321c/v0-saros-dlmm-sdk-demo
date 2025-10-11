#!/bin/bash

# Install dependencies
pnpm install

# Build frontend
pnpm run build

# Build backend
cd server
pnpm install
pnpm run build
cd ..

# Start backend server (serves both API and frontend static files)
cd server
node dist/index.js
