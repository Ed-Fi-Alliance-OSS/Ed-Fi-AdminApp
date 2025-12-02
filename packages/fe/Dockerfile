# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

# Multi-stage build for frontend
FROM node:22-alpine@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5 AS build

WORKDIR /app

ENV NODE_ENV=development \
  NX_DAEMON=false \
  NX_VERBOSE_LOGGING=true \
  NX_TASKS_TARGET_OUTPUT_USE_STDOUT=true \
  NODE_OPTIONS="--max-old-space-size=4096"

# Copy only manifest + workspace config for efficient layer caching
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Copy only required package sources (adjust if FE imports others)
COPY packages/fe ./packages/fe
COPY packages/common-ui ./packages/common-ui
COPY packages/models ./packages/models
COPY packages/utils ./packages/utils
COPY types ./types

# Install deps, reset Nx cache, and build in one layer
RUN --mount=type=cache,target=/root/.npm \
  npm ci && \
  npx nx reset --yes && \
  npx nx run fe:build:production --skip-nx-cache --verbose --output-style=stream

# Production stage with nginx
FROM nginx:alpine@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14 AS production
# Ensure runtime environment is production for nginx image
ENV NODE_ENV=production

# Install runtime tools (jq for safe JSON, curl for healthcheck), then remove default site config
RUN apk add --no-cache jq=~1 curl=~8 \
  && rm /etc/nginx/conf.d/default.conf

# Copy built static assets
COPY --from=build /app/dist/packages/fe /usr/share/nginx/html

# Copy entrypoint script
COPY packages/fe/entrypoint.sh /entrypoint.sh

# Create nginx user and set up directories with proper permissions
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S nginx-app -u 1001 -G nginx-app && \
    mkdir -p /var/cache/nginx /var/log/nginx /var/run/nginx && \
    chown -R nginx-app:nginx-app \
        /var/cache/nginx \
        /var/log/nginx \
        /var/run/nginx \
        /etc/nginx \
        /usr/share/nginx/html && \
    chmod +x /entrypoint.sh

# Switch to non-root user
USER nginx-app

EXPOSE 4200

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4200/health || exit 1

# Start nginx in foreground
ENTRYPOINT ["/entrypoint.sh"]
