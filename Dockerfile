# Multi-stage build for Railway optimization
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json* ./

# Install dependencies including dev dependencies for build (skip prepare script)
RUN npm ci --include=dev --ignore-scripts

# Copy source files and TypeScript config
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript project
RUN npm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies (skip prepare script)
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create directory for credentials and config
RUN mkdir -p /app/credentials

# Set environment variables for Railway compatibility
ENV NODE_ENV=production
ENV GMAIL_CREDENTIALS_PATH=/app/credentials/credentials.json
ENV GMAIL_OAUTH_PATH=/app/credentials/gcp-oauth.keys.json

# Railway-specific environment variables support
# PORT will be provided by Railway at runtime
ENV PORT=3000

# Expose the port (Railway will override this with its own PORT)
EXPOSE 3000

# Add health check for Railway monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set entrypoint command
ENTRYPOINT ["node", "dist/index.js"]