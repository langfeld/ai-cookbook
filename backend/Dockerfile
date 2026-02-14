# ============================================
# Backend Dockerfile - Node.js Fastify API
# ============================================

FROM node:22-alpine AS builder

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
RUN npm ci --only=production

# Quellcode kopieren
COPY . .

# --- Production Stage ---
FROM node:22-alpine

WORKDIR /app

# Datenverzeichnis erstellen
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data

# Dependencies vom Builder kopieren
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src

# Nicht als Root laufen
USER node

EXPOSE 3001

# Health-Check Tool
RUN wget -q -O /dev/null http://localhost:3001/health || true

CMD ["node", "src/server.js"]
