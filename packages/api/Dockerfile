# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

FROM node:22-alpine@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5 AS build

WORKDIR /app

# Install build toolchain needed for any native deps during install
RUN apk add --no-cache --virtual .build-deps python3~=3.12 make~=4.4 g++~=14

# Copy package files first for better caching
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Install ALL dependencies for building (use cache for npm)
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy all packages, types, and config (filtered by .dockerignore)
COPY packages/ ./packages/
COPY types/ ./types/
# Copy our configuration
COPY packages/api/config/local.js-edfi-docker ./packages/api/config/local.js

ENV NODE_OPTIONS="--max-old-space-size=4096" \
  NX_DAEMON=false \
  NX_PERF_LOGGING=true \
  NX_TASKS_TARGET_OUTPUT_USE_STDOUT=true \
  NODE_ENV=production

# Reset NX cache to avoid conflicts
RUN npx nx reset --yes

# Build the application with verbose logging & explicit progress
ENV NX_VERBOSE_LOGGING=true
# Use explicit nx run invocation with skip cache for deterministic CI, and show webpack progress
RUN npx nx run api:build:production --skip-nx-cache --verbose --output-style=stream

# Install runtime dependencies, clean up build toolchain, and create logs dir
RUN apk add --no-cache curl=~8 && \
  apk del .build-deps && \
  mkdir -p logs

EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD curl -f http://localhost:3333/api/healthcheck || exit 1

# Start the built application
CMD ["node", "dist/packages/api/main.js"]
