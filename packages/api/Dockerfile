FROM node:22-alpine@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5 AS build

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Install ALL dependencies for building
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy all packages, types, and config (filtered by .dockerignore)
COPY packages/ ./packages/
COPY types/ ./types/
# Copy our configuration
COPY packages/api/config/local.js-edfi-docker ./packages/api/config/local.js

# Reset NX cache to avoid conflicts
RUN npx nx reset

# Build the application with optimizations
RUN export NODE_OPTIONS="--max-old-space-size=4096" && \
    npm run build:api

# Install system dependencies and create logs directory
RUN apk add --no-cache curl && \
    mkdir -p logs

EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:3333/api/healthcheck || exit 1

# Start the built application
CMD ["node", "dist/packages/api/main.js"]
