# --- Stage 1: Build the React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app-frontend

# Copy frontend config
COPY package.json package-lock.json ./
RUN npm ci

# Copy frontend source
COPY . .
# Build (creates /app-frontend/dist)
RUN npm run build


# --- Stage 2: Setup the Backend ---
FROM node:20-alpine AS backend
WORKDIR /app

# Install system dependencies (needed for 'sharp' image processing)
RUN apk add --no-cache vips-dev python3 make g++

# 1. Setup Backend Dependencies
COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
# Install ALL dependencies (including ts-node for runtime)
RUN npm ci

# 2. Copy Source Files
# We must preserve the directory structure because server.ts imports "../types"
WORKDIR /app
COPY types.ts ./types.ts
COPY server ./server

# 3. Copy Built Frontend from Stage 1
# We place it in 'server/public_html' so the code we added in Step 1 finds it
COPY --from=frontend-builder /app-frontend/dist ./server/public_html

# 4. Environment & Permissions
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

# Create data directories so permissions are correct
RUN mkdir -p /app/data/images /app/data/thumbnails /app/data/avatars

# Expose the port
EXPOSE 3000

# Start command
WORKDIR /app/server
CMD ["npx", "ts-node", "server.ts"]