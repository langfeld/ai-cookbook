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
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config/env.js';
import { initializeDatabase } from './config/database.js';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

// --- Routen importieren ---
import authRoutes from './routes/auth.js';
import recipesRoutes from './routes/recipes.js';
import categoriesRoutes from './routes/categories.js';
import mealplanRoutes from './routes/mealplan.js';
import shoppingRoutes from './routes/shopping.js';
import pantryRoutes from './routes/pantry.js';
import reweRoutes from './routes/rewe.js';

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
  },
  // Maximale Body-Größe für Foto-Uploads
  bodyLimit: config.upload.maxSize,
});

// ============================================
// Plugins registrieren
// ============================================

// CORS für Frontend-Zugriff
await app.register(cors, {
  origin: config.isDev
    ? ['http://localhost:5173', 'http://localhost:8080']
    : ['http://localhost:8080'],
  credentials: true,
});

// JWT für Authentifizierung
await app.register(jwt, {
  secret: config.jwt.secret,
  sign: { expiresIn: config.jwt.expiresIn },
});

// Multipart für Datei-Uploads (Fotos)
await app.register(multipart, {
  limits: {
    fileSize: config.upload.maxSize,
    files: 1,
  },
});

// Statische Dateien (Uploads)
await app.register(fastifyStatic, {
  root: uploadPath,
  prefix: '/api/uploads/',
  decorateReply: false,
});

// Swagger API-Dokumentation
await app.register(swagger, {
  openapi: {
    info: {
      title: 'AI Cookbook API',
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

// ============================================
// Auth-Decorator: Authentifizierung prüfen
// ============================================
app.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Nicht autorisiert. Bitte anmelden.' });
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

    // Server starten
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 AI Cookbook Backend läuft auf Port ${config.port}`);
    console.log(`📚 API-Docs: http://localhost:${config.port}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
