# --- Stage 1: Build the React Frontend ---
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
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 2. Setup Backend Dependencies
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
ENV PORT=3000
# This matches the clean "Docker way" we discussed
ENV DATA_DIR=/data

# FIX: Create directories at /data (matching the ENV variable above)
# We also create /data/avatars so it exists even if empty
RUN mkdir -p /data/images /data/thumbnails /data/avatars

# Expose port
EXPOSE 3000

# Start command
WORKDIR /app/server
CMD ["npx", "ts-node", "server.ts"]