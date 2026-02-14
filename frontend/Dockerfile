# ============================================
# Frontend Dockerfile - Vue 3 SPA
# ============================================
# Multi-Stage Build: Erst bauen, dann mit Nginx ausliefern

# --- Build Stage ---
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production Stage ---
FROM nginx:alpine

# Vue SPA Routing: Alle Anfragen an index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Gebaute Dateien kopieren
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
