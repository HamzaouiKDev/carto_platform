# ── Stage 1: Build & Dependencies ──
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

# ── Stage 2: Minimal Production Runtime ──
FROM node:20-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Install curl for container health check
RUN apk --no-cache add curl

# Copy node_modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/
COPY migrations/ ./migrations/

# Security: Run as unprivileged node user
USER node

EXPOSE 4000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

CMD ["node", "src/index.js"]
