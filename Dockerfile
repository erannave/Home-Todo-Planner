# Stage 1: Build
FROM oven/bun:1 AS build

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Stage 2: Runtime
FROM oven/bun:1-slim AS runtime

WORKDIR /app

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create data directory
RUN mkdir -p /app/data

# Copy built artifacts from build stage
COPY --from=build /app/dist/server /app/server
COPY --from=build /app/public /app/public
COPY docker-entrypoint.sh /app/

RUN chmod +x /app/docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/chores.db
ENV ALLOW_SIGNUPS=false

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
ENTRYPOINT ["/app/docker-entrypoint.sh"]
