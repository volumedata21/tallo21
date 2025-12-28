FROM node:22-alpine

WORKDIR /app

# Install build dependencies for SQLite
RUN apk add --no-cache python3 make g++

# Copy backend package files
COPY server/package*.json ./
RUN npm install

# Copy backend source code
COPY server/ .

# Copy shared types from root
COPY src/types.ts ./types.ts

# Create Data Directory
RUN mkdir -p /app/data/uploads

# Build TypeScript
RUN npm run build

EXPOSE 4000
CMD ["npm", "start"]