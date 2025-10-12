# ---- Base build stage ----
    FROM node:20 AS builder

    WORKDIR /app/server
    
    # Copy only server and shared package files for caching
    COPY server/package*.json ./
    COPY shared ./../shared
    
    # Install dependencies (include dev for build)
    RUN npm install
    
    # Copy source code
    COPY server ./
    
    # Build TypeScript -> dist/
    RUN npm run build
    
    # ---- Production stage ----
    FROM node:20-slim AS runner
    
    WORKDIR /app/server
    
    # Copy only the compiled output + necessary files
    COPY --from=builder /app/server/dist ./dist
    COPY server/package*.json ./
    
    # Install only production dependencies
    RUN npm install --omit=dev
    
    # Use port provided by the hosting platform (default 3000)
    ENV PORT=3000
    EXPOSE ${PORT}
    
    # Start the compiled JS server
    CMD ["node", "dist/index.js"]
    