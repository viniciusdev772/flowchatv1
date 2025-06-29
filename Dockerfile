# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install system dependencies including MongoDB
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    python3 \
    make \
    g++ \
    curl \
    bash \
    tzdata \
    tini \
    wget \
    tar

# Install MongoDB manually
RUN mkdir -p /tmp/mongodb && \
    wget -qO- https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-alpine-7.0.14.tgz | tar xz -C /tmp/mongodb --strip-components=1 && \
    mv /tmp/mongodb/bin/* /usr/local/bin/ && \
    rm -rf /tmp/mongodb && \
    mkdir -p /data/db /var/log/mongodb

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

# Copy and set up entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create necessary directories (including MongoDB dirs)
RUN mkdir -p \
    .sessions \
    .media \
    uploads \
    downloads \
    auth_sessions \
    logs \
    /data/db \
    /var/log/mongodb

# Set proper permissions for app directories
RUN chown -R node:node /app \
    && chown -R node:node /data/db \
    && chown -R node:node /var/log/mongodb

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:3000/api/management/health || exit 1

# Set timezone
ENV TZ=America/Sao_Paulo

EXPOSE 3000

# Use entrypoint que inicia MongoDB + Baileys
ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["npm", "start"]