# ---- Base build stage ----
    FROM node:24 AS builder

    WORKDIR /app
    
    # Copy package files
    COPY package*.json ./
    COPY server/package*.json ./server/
    
    # Install root deps (shared dependencies)
    RUN npm install
    
    # Install server deps
    RUN cd server && npm install
    
    # Copy relevant source files
    COPY server ./server
    COPY shared ./shared
    
    # Build and verify output
    RUN cd server && npm run build && \
        echo "Build contents:" && ls -la dist || \
        (echo "❌ Build failed or dist not found" && exit 1)
    
    # ---- Runtime stage ----
    FROM node:20-slim AS runner
    
    WORKDIR /app/server
    
    COPY --from=builder /app/server/dist ./dist
    COPY server/package*.json ./
    COPY --from=builder /app/shared ./../shared
    
    RUN npm install --omit=dev
    
    ENV PORT=3000
    EXPOSE ${PORT}
    
    # Add check to confirm dist exists before start
    CMD [ "sh", "-c", "ls -la dist || (echo '❌ dist missing'; exit 1); node dist/index.js" ]
    