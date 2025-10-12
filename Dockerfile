FROM node:20

WORKDIR /app

# Copy packages
COPY package*.json ./
COPY server/package*.json ./server/

# Install deps
RUN npm install
RUN cd server && npm install

# Copy code
COPY . .

# Build with verbose + check
RUN cd server && npm run build -- --diagnostics && ls -la dist/index.js || (echo "Build failed: No dist/index.js—check diagnostics above" && exit 1)

EXPOSE 3000

CMD ["sh", "-c", "cd server && npm start"]