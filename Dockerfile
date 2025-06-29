# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install system dependencies INCLUDING MongoDB
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    python3 \
    make \
    g++ \
    curl \
    mongodb \
    mongodb-tools

WORKDIR /app

# Copy package files
COPY package*.json ./

# Stage 1: Backend dependencies
FROM base AS backend-deps
RUN npm install --only=production && npm cache clean --force

# Stage 2: Frontend build
FROM base AS frontend-build
COPY frontend/package*.json frontend/
WORKDIR /app/frontend
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 3: Production image
FROM base AS production
WORKDIR /app

# Copy backend dependencies
COPY --from=backend-deps /app/node_modules ./node_modules

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy application code
COPY . .

# Copy startup script
COPY start-all.sh ./
RUN chmod +x start-all.sh

# Create necessary directories for MongoDB and app
RUN mkdir -p uploads downloads auth_sessions logs /data/db /var/log/mongodb

# Set proper permissions
RUN chown -R node:node /app/uploads /app/downloads /app/auth_sessions /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/management/health || exit 1

EXPOSE 3000

# Use script que inicia MongoDB + Baileys
CMD ["./start-all.sh"]