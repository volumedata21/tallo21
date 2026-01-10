# --- Stage 1: Build the React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app-frontend

# Copy frontend config
COPY package.json package-lock.json ./
# Use 'npm install' here too, just to be safe
RUN npm install

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
COPY server/package.json ./server/
WORKDIR /app/server

# --- FIX IS HERE: Changed 'npm ci' to 'npm install' ---
RUN npm install

# 2. Copy Source Files
WORKDIR /app
COPY types.ts ./types.ts
COPY server ./server

# 3. Copy Built Frontend from Stage 1
COPY --from=frontend-builder /app-frontend/dist ./server/public_html

# 4. Environment & Permissions
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

# Create data directories
RUN mkdir -p /app/data/images /app/data/thumbnails /app/data/avatars

# Expose the port
EXPOSE 3000

# Start command
WORKDIR /app/server
CMD ["npx", "ts-node", "server.ts"]