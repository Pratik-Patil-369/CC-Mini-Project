# ── Stage 1: Build React Client ──────────────────────────
FROM node:22-alpine AS client-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: Production Server ──────────────────────────
FROM node:22-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy docker binary from official docker image (reliable DinD method)
COPY --from=docker:latest /usr/local/bin/docker /usr/local/bin/docker

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server code
COPY server/server.js ./server/
COPY server/problems.json ./server/

# Copy built client from stage 1
COPY --from=client-build /app/client/dist ./client/dist

# Create temp directory for Docker job files
RUN mkdir -p /app/server/temp

EXPOSE 3000

WORKDIR /app/server
CMD ["node", "server.js"]
