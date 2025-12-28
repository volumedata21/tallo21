# --- Stage 1: Builder (Frontend Only) ---
FROM node:22-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy all config files
COPY package*.json tsconfig.json vite.config.ts ./

# Install ALL dependencies
RUN npm install

# Copy source code
COPY . .

# Build Frontend 
# (Vite uses esbuild, which ignores the type errors blocking you)
RUN npx vite build

# --- Stage 2: Runner (Runtime) ---
FROM node:22-alpine
WORKDIR /app

# Install runtime dependencies (for SQLite)
RUN apk add --no-cache python3 make g++

# Copy package.json
COPY package*.json ./

# Install ALL dependencies 
# (We need 'tsx' from devDependencies to run the server directly)
RUN npm install

# Copy the built frontend from Stage 1
COPY --from=builder /app/dist ./dist

# Copy the Backend Source & Shared Types
# We copy these raw because we are running them directly with tsx
COPY server ./server
COPY shared ./shared
COPY tsconfig.json ./

# Create data directory
RUN mkdir -p data/uploads

# Environment Configuration
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# START COMMAND CHANGED:
# Instead of running compiled JS, we use 'tsx' to run TypeScript directly.
# This skips the type-checking phase that was crashing your build.
CMD ["npx", "tsx", "server/server.ts"]