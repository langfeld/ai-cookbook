/**
 * ============================================
 * Fastify Server - Einstiegspunkt
 * ============================================
 * Initialisiert den Fastify-Server mit allen Plugins und Routen.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config/env.js';
import { initializeDatabase } from './config/database.js';
import db from './config/database.js';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// --- Routen importieren ---
import authRoutes from './routes/auth.js';
import recipesRoutes from './routes/recipes.js';
import categoriesRoutes from './routes/categories.js';
import mealplanRoutes from './routes/mealplan.js';
import shoppingRoutes from './routes/shopping.js';
import pantryRoutes from './routes/pantry.js';
import reweRoutes from './routes/rewe.js';
import reweUserscriptRoute from './routes/rewe-userscript.js';
import adminRoutes from './routes/admin.js';
import ingredientIconRoutes from './routes/ingredient-icons.js';
import bringRoutes from './routes/bring.js';
import collectionsRoutes from './routes/collections.js';
import ingredientAliasRoutes from './routes/ingredient-aliases.js';
import recipeBlockRoutes from './routes/recipe-blocks.js';
import backupRoutes from './routes/backup.js';
// ingredient-conversions entfernt – KI-Aggregation ersetzt zutat-spezifische Umrechnungen

// Upload-Verzeichnisse sicherstellen (inkl. Unterordner)
const uploadPath = resolve(config.upload.path);
for (const sub of ['', 'recipes']) {
  const dir = resolve(uploadPath, sub);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Fastify-Instanz erstellen und konfigurieren
 */
const app = Fastify({
  logger: {
    level: config.isDev ? 'info' : 'warn',
    transport: config.isDev
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
    // Sicherheit: Token aus URLs in Logs redaktieren
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url.replace(/token=[^&]+/g, 'token=***'),
          host: request.hostname,
          remoteAddress: request.ip,
          remotePort: request.socket?.remotePort,
        };
      },
    },
  },
  // Maximale Body-Größe für Foto-Uploads
  bodyLimit: config.upload.maxSize,
});

// ============================================
// Plugins registrieren
// ============================================

// CORS für Frontend-Zugriff
await app.register(cors, {
  origin: config.isDev ? true : (process.env.FRONTEND_URL || false),
  credentials: true,
});

// Security Headers (CSP, HSTS, X-Frame-Options etc.)
await app.register(helmet, {
  contentSecurityPolicy: false, // Wird vom Frontend/Nginx gehandhabt
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Für Bild-Uploads
});

// Globales Rate Limiting (100 Requests/Minute pro IP, nur für API-Routen)
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,
  allowList: (request) => {
    // Statische Assets und SPA-Routen nicht rate-limiten
    return !request.url.startsWith('/api/');
  },
});

// JWT für Authentifizierung
await app.register(jwt, {
  secret: config.jwt.secret,
  sign: { expiresIn: config.jwt.expiresIn },
});

// Multipart für Datei-Uploads (Fotos, bis zu 10 Seiten)
await app.register(multipart, {
  limits: {
    fileSize: config.upload.maxSize,
    files: 10,
  },
});

// Statische Dateien (Uploads)
await app.register(fastifyStatic, {
  root: uploadPath,
  prefix: '/api/uploads/',
  decorateReply: false,
});

// Frontend SPA ausliefern (nur wenn /public existiert, also im Docker-Build)
const publicPath = resolve('public');
if (existsSync(publicPath)) {
  await app.register(fastifyStatic, {
    root: publicPath,
    prefix: '/',
    decorateReply: false,
    wildcard: false,
  });

  // SPA-Fallback: Alle unbekannten Routen → index.html
  const indexHtml = readFileSync(resolve(publicPath, 'index.html'));
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.status(404).send({ error: 'Route nicht gefunden.' });
    } else {
      reply.type('text/html').send(indexHtml);
    }
  });
}

// Swagger API-Dokumentation (nur in Entwicklung)
if (config.isDev) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Zauberjournal API',
        description: 'KI-gestützte Rezeptverwaltung mit Wochenplaner und Einkaufsliste',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}

// ============================================
// Auth-Decorator: Authentifizierung prüfen
// ============================================
app.decorate('authenticate', async function (request, reply) {
  // 1. API-Key Auth (für Userscript – dauerhaft, kein Ablauf)
  const apiKey = request.headers['x-api-key'];
  if (apiKey) {
    const user = db.prepare('SELECT id, username, role FROM users WHERE api_key = ? AND is_active = 1').get(apiKey);
    if (!user) {
      return reply.status(401).send({ error: 'Ungültiger API-Key.' });
    }
    request.user = user;
    return;
  }
  // 2. JWT Auth (Standard)
  try {
    await request.jwtVerify();
    // Prüfen ob Benutzer noch aktiv ist
    const user = db.prepare('SELECT id, username, role, is_active FROM users WHERE id = ?').get(request.user.id);
    if (!user || !user.is_active) {
      return reply.status(401).send({ error: 'Benutzerkonto deaktiviert.' });
    }
    request.user = { id: user.id, username: user.username, role: user.role };
  } catch (err) {
    reply.status(401).send({ error: 'Nicht autorisiert. Bitte anmelden.' });
  }
});

// Admin-Decorator: Authentifizierung (JWT oder API-Key) + Admin-Rolle prüfen
app.decorate('requireAdmin', async function (request, reply) {
  await app.authenticate(request, reply);
  if (reply.sent) return; // authenticate hat bereits 401 gesendet
  if (request.user.role !== 'admin') {
    return reply.status(403).send({ error: 'Nur Administratoren haben Zugriff.' });
  }
});

// ============================================
// Routen registrieren
// ============================================
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(recipesRoutes, { prefix: '/api/recipes' });
await app.register(categoriesRoutes, { prefix: '/api/categories' });
await app.register(mealplanRoutes, { prefix: '/api/mealplan' });
await app.register(shoppingRoutes, { prefix: '/api/shopping' });
await app.register(pantryRoutes, { prefix: '/api/pantry' });
await app.register(reweRoutes, { prefix: '/api/rewe' });
await app.register(reweUserscriptRoute, { prefix: '/api/rewe' });
await app.register(adminRoutes, { prefix: '/api/admin' });
await app.register(ingredientIconRoutes, { prefix: '/api/ingredient-icons' });
await app.register(bringRoutes, { prefix: '/api/bring' });
await app.register(collectionsRoutes, { prefix: '/api/collections' });
    await app.register(ingredientAliasRoutes, { prefix: '/api/ingredient-aliases' });
    await app.register(recipeBlockRoutes, { prefix: '/api/recipe-blocks' });
    await app.register(backupRoutes, { prefix: '/api/backup' });
    // ingredient-conversions Route entfernt

// ============================================
// Health Check Endpoint
// ============================================
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
}));

// ============================================
// Server starten
// ============================================
const start = async () => {
  try {
    // Datenbank initialisieren
    initializeDatabase();
    console.log('🗄️  Datenbank bereit');

    // Sicherheitswarnung: JWT-Secret prüfen
    if (!config.isDev && config.jwt.secret === 'dev-secret-bitte-in-prod-aendern') {
      console.error('⚠️  WARNUNG: Standard-JWT-Secret in Produktion! Bitte JWT_SECRET in .env setzen.');
      process.exit(1);
    }

    // Server starten
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 Zauberjournal läuft auf Port ${config.port}`);
    if (config.isDev) console.log(`📚 API-Docs: http://localhost:${config.port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful Shutdown (Docker stop)
const shutdown = async (signal) => {
  console.log(`\n⏹️  ${signal} — fahre herunter…`);
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
