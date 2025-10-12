# Use full Node 20 (Debian base—no Alpine gyp issues)
FROM node:22

# Set working dir (full monorepo at root)
WORKDIR /app

# Copy package files for caching
COPY package*.json ./
COPY server/package*.json ./server/

# Install root deps (client/shared)
RUN npm install

# Install server deps
RUN cd server && npm install

# Copy source
COPY . .

# Build server
RUN cd server && npm run build

# Prune dev deps (slim runtime)
RUN npm prune --production
RUN cd server && npm prune --production

# Expose port
EXPOSE 3000

# Run from server
CMD ["sh", "-c", "cd server && npm start"]