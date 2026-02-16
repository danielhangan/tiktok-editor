FROM jrottenberg/ffmpeg:7.1-scratch AS ffmpeg

FROM node:22-alpine AS base

# Copy ffmpeg binaries
COPY --from=ffmpeg /bin/ffmpeg /bin/ffmpeg
COPY --from=ffmpeg /bin/ffprobe /bin/ffprobe
COPY --from=ffmpeg /lib /lib

# Install fonts and su-exec for privilege dropping
RUN apk add --no-cache fontconfig ttf-dejavu su-exec

WORKDIR /app

# Dependencies stage
FROM base AS deps

COPY package*.json ./
RUN npm ci --omit=dev

# Build stage
FROM base AS build

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage
FROM base AS runtime

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create data directories (will be overwritten by volume mount, but good for local dev)
RUN mkdir -p /app/data/uploads/reactions /app/data/uploads/demos /app/data/output && \
    chown -R nodejs:nodejs /app/data

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs public ./public

# Add entrypoint script (fixes volume permissions at runtime)
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["sh", "-c", "if [ -n \"$REDIS_URL\" ]; then npm run start:with-worker; else npm start; fi"]
