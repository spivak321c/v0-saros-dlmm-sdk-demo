FROM node:20

WORKDIR /app

# Copy packages
COPY package*.json ./
COPY server/package*.json ./server/

# Install deps (normal, no ci)
RUN npm install
RUN cd server && npm install

# Copy code
COPY . .

# Build with check (fails if no dist/index.js)
RUN cd server && npm run build && ls -la dist/index.js || (echo "Build failed: No dist/index.js" && exit 1)

# Prune dev
RUN npm prune --production
RUN cd server && npm prune --production

EXPOSE 3000

CMD ["sh", "-c", "cd server && npm start"]