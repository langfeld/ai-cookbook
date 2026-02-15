# ============================================
# AI Cookbook — Single-Container Build
# ============================================
# Ein Image, ein Container, ein Port.
# Backend (Fastify) liefert das Frontend gleich mit aus.

# --- Stage 1: Frontend bauen ---
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Backend + Frontend zusammenführen ---
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production

# su-exec für PUID/PGID-Wechsel + Build-Tools für native Module
RUN apk add --no-cache su-exec python3 make g++ \
 && mkdir -p /app/data/uploads /app/public \
 && chown -R node:node /app/data

# Backend-Dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Backend-Code
COPY backend/src ./src

# Frontend-Build vom ersten Stage
COPY --from=frontend /build/dist ./public

# Entrypoint (PUID/PGID-Handling)
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/server.js"]
