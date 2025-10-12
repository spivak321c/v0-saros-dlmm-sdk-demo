# ---- Base build stage ----
    FROM node:20 AS builder

    WORKDIR /app
    
    # Copy package files (root + server)
    COPY package*.json ./
    COPY server/package*.json ./server/
    
    # Install root dependencies first (needed for shared)
    RUN npm install
    
    # Install server-specific dependencies
    RUN cd server && npm install
    
    # Copy source code (server + shared only)
    COPY server ./server
    COPY shared ./shared
    
    # Build the server (outputs to /app/server/dist)
    RUN cd server && npm run build
    
    # ---- Production stage ----
    FROM node:20-slim AS runner
    
    WORKDIR /app/server
    
    # Copy compiled server and package files
    COPY --from=builder /app/server/dist ./dist
    COPY server/package*.json ./
    
    # Copy shared folder (if server runtime imports from it)
    COPY --from=builder /app/shared ./../shared
    
    # Install only production dependencies
    RUN npm install --omit=dev
    
    # Port provided by Sevalla or fallback to 3000
    ENV PORT=3000
    EXPOSE ${PORT}
    
    CMD ["node", "dist/index.js"]
    