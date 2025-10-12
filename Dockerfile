# Use Node 20 (matches your deps like @types/node@20.x)
FROM node:22-alpine

# Install build tools for native deps (gyp/node-gyp fixes)
RUN apk add --no-cache python3 make g++

# Set working dir inside container (full monorepo at root)
WORKDIR /app

# Copy package files first (for layer caching: root + server)
COPY package*.json ./
COPY server/package*.json ./server/

# Install root deps (client/shared)
RUN npm ci

# Install server deps
RUN cd server && npm ci

# Copy full source code
COPY . .

# Build: Mirrors Render command (root already installed, now server build)
RUN cd server && npm run build

# Prune dev deps post-build (root + server for slim image)
RUN npm ci --only=production --prefix . && \
    cd server && npm ci --only=production && \
    npm cache clean --force

# Remove build tools (slim image)
RUN apk del python3 make g++

# Expose port (Railway uses $PORT env var)
EXPOSE 3000

# Health check (Railway pings /health)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run the app (from server dir)
CMD ["sh", "-c", "cd server && npm start"]