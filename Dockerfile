# ---- Base build stage ----
    FROM node:24 AS builder

    WORKDIR /app
    
    # Copy package files
    COPY package*.json ./
    COPY server/package*.json ./server/
    
    # Install root and server dependencies
    RUN npm install && cd server && npm install
    
    # Copy source code
    COPY server ./server
    COPY shared ./shared
    
    # Build TypeScript (output goes to /app/dist)
    RUN npx tsc --project server/tsconfig.json && \
        echo "✅ Build completed. Checking contents:" && ls -R dist || \
        (echo "❌ Build failed: dist missing" && exit 1)
    
    # ---- Runtime stage ----
    FROM node:24-slim AS runner
    
    WORKDIR /app
    
    # Copy only what’s needed to run
    COPY --from=builder /app/dist ./dist
    COPY package*.json ./
    COPY --from=builder /app/shared ./shared
    
    # Install only production dependencies
    RUN npm install --omit=dev
    
    ENV PORT=3000
    EXPOSE ${PORT}
    
    # ✅ Correct path to compiled entry point
    CMD ["node", "dist/server/index.js"]
    