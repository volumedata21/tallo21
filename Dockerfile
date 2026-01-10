# --- Stage 1: Build the React Frontend ---
# We use 'slim' here too for consistency, though alpine would probably work for this stage.
FROM node:20-slim AS frontend-builder
WORKDIR /app-frontend

# Copy package.json and lockfile
COPY package.json package-lock.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# --- Stage 2: Setup the Backend ---
FROM node:20-slim AS backend
WORKDIR /app

# 1. Install System Dependencies
# We install these just in case a native module still needs to build from source
# 'openssl' is often needed by Prisma or other DB tools, 'python3/make/g++' for node-gyp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 2. Setup Backend Dependencies
# Copy ONLY package.json to ensure we get fresh, Linux-compatible dependencies
COPY server/package.json ./server/
WORKDIR /app/server
RUN npm install

# 3. Copy Source Files
WORKDIR /app
COPY types.ts ./types.ts
COPY server ./server

# 4. Copy Built Frontend from Stage 1
COPY --from=frontend-builder /app-frontend/dist ./server/public_html

# 5. Environment & Permissions
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

# Create data directories
RUN mkdir -p /app/data/images /app/data/thumbnails /app/data/avatars

# Expose port
EXPOSE 3000

# Start command
WORKDIR /app/server
CMD ["npx", "ts-node", "server.ts"]