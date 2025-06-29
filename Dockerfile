# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    python3 \
    make \
    g++ \
    curl \
    bash \
    tzdata \
    tini

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
FROM base AS dependencies
RUN npm ci --only=production && npm cache clean --force

# Frontend build stage
FROM base AS frontend-build
COPY frontend/package*.json frontend/
WORKDIR /app/frontend
RUN npm ci
COPY frontend/ .
RUN npm run build

# Final production stage
FROM base AS production
WORKDIR /app

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p \
    .sessions \
    .media \
    uploads \
    downloads \
    auth_sessions \
    logs

# Set proper permissions
RUN chown -R node:node /app
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/management/health || exit 1

# Set timezone
ENV TZ=America/Sao_Paulo

EXPOSE 3000

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]