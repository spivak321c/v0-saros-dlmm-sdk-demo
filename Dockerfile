# ---- Base build stage ----
    FROM node:24 AS builder

    WORKDIR /app
    
    # Copy package files
    COPY package*.json ./
    COPY server/package*.json ./server/
    
    # Install root and server deps
    RUN npm install && cd server && npm install
    
    # Copy source code
    COPY server ./server
    COPY shared ./shared
    
    # Force build output to /app/server/dist
    RUN cd server && npx tsc --project tsconfig.json --outDir dist && \
        echo "✅ Build completed. Checking contents:" && ls -R dist || \
        (echo "❌ Build failed: dist missing" && exit 1)
    
    # ---- Runtime stage ----
    FROM node:24-slim AS runner
    
    WORKDIR /app/server
    
    COPY --from=builder /app/server/dist ./dist
    COPY server/package*.json ./
    COPY --from=builder /app/shared ./../shared
    
    RUN npm install --omit=dev
    
    ENV PORT=3000
    EXPOSE ${PORT}
    
    CMD ["node", "dist/server/index.js"]
    