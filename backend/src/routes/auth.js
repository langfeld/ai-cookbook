/**
 * ============================================
 * Auth Routen - Registrierung & Login
 * ============================================
 * Einfache JWT-basierte Authentifizierung.
 * Passwörter werden mit bcrypt gehasht.
 */

import bcrypt from 'bcryptjs';
import db from '../config/database.js';
import { createDefaultCategories } from '../config/database.js';

export default async function authRoutes(fastify) {
  // ============================================
  // Helper: Prüfen ob ein Admin existiert
  // ============================================
  function hasAdmin() {
    return !!db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  }

  /**
   * GET /api/auth/setup-status
   * Öffentlicher Endpoint: Prüft ob die App eingerichtet ist
   */
  fastify.get('/setup-status', {
    schema: {
      description: 'Prüft ob die Ersteinrichtung noch aussteht',
      tags: ['Auth'],
    },
  }, async () => {
    const adminExists = hasAdmin();
    // Registrierungs-Setting nur relevant, wenn ein Admin existiert
    let registrationEnabled = true;
    if (adminExists) {
      const setting = db.prepare("SELECT value FROM settings WHERE key = 'registration_enabled'").get();
      registrationEnabled = !setting || setting.value !== 'false';
    }
    return {
      needsSetup: !adminExists,
      registrationEnabled,
    };
  });

  /**
   * POST /api/auth/register
   * Neuen Benutzer registrieren
   * → Erster registrierter Benutzer wird automatisch Admin
   */
  fastify.post('/register', {
    config: {
      rateLimit: { max: 5, timeWindow: '15 minutes' },
    },
    schema: {
      description: 'Neuen Benutzer registrieren',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          display_name: { type: 'string', maxLength: 100 },
        },
      },
    },
  }, async (request, reply) => {
    const { username, email, password, display_name } = request.body;

    // Setup-Modus: Noch kein Admin? → Erster User wird Admin
    const isSetupMode = !hasAdmin();

    // Registrierung deaktiviert? (nur wenn bereits ein Admin existiert)
    if (!isSetupMode) {
      const setting = db.prepare("SELECT value FROM settings WHERE key = 'registration_enabled'").get();
      if (setting && setting.value === 'false') {
        return reply.status(403).send({
          error: 'Die Registrierung ist derzeit deaktiviert. Bitte wende dich an einen Administrator.',
        });
      }
    }

    // Prüfen ob User schon existiert
    const existing = db.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(username, email);

    if (existing) {
      return reply.status(409).send({
        error: 'Benutzername oder E-Mail bereits vergeben',
      });
    }

    // Passwort hashen (Kostenfaktor 12 für gute Sicherheit)
    const passwordHash = await bcrypt.hash(password, 12);

    // Rolle bestimmen: Erster User → Admin, sonst → User
    const role = isSetupMode ? 'admin' : 'user';

    // Benutzer anlegen
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)'
    ).run(username, email, passwordHash, display_name || username, role);

    const userId = result.lastInsertRowid;

    // Standard-Kategorien für den neuen User anlegen
    createDefaultCategories(userId);

    // Bei Ersteinrichtung: Admin-Log schreiben
    if (isSetupMode) {
      try {
        db.prepare('INSERT INTO admin_logs (user_id, action, details) VALUES (?, ?, ?)')
          .run(userId, 'Ersteinrichtung', `Erster Admin-Account erstellt: ${username}`);
      } catch { /* Logging-Fehler ignorieren */ }
    }

    // JWT Token generieren
    const token = fastify.jwt.sign({
      id: userId,
      username,
      role,
    });

    return reply.status(201).send({
      message: isSetupMode
        ? 'Willkommen! Dein Admin-Account wurde erstellt.'
        : 'Registrierung erfolgreich!',
      token,
      user: {
        id: userId,
        username,
        email,
        display_name: display_name || username,
        role,
      },
    });
  });

  /**
   * POST /api/auth/login
   * Benutzer anmelden
   */
  fastify.post('/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
    schema: {
      description: 'Benutzer anmelden',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['login', 'password'],
        properties: {
          login: { type: 'string' }, // Username oder Email
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { login, password } = request.body;

    // User suchen (nach Username oder Email)
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? OR email = ?'
    ).get(login, login);

    if (!user) {
      return reply.status(401).send({
        error: 'Ungültige Anmeldedaten',
      });
    }

    // Gesperrten Benutzer blockieren
    if (!user.is_active) {
      return reply.status(403).send({
        error: 'Dein Konto wurde gesperrt. Bitte wende dich an einen Administrator.',
      });
    }

    // Passwort prüfen
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({
        error: 'Ungültige Anmeldedaten',
      });
    }

    // JWT Token generieren
    const token = fastify.jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role || 'user',
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        role: user.role || 'user',
      },
    };
  });

  /**
   * GET /api/auth/me
   * Aktuellen Benutzer abrufen (geschützt)
   */
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'Aktuellen Benutzer abrufen',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const user = db.prepare(
      'SELECT id, username, email, display_name, role, created_at FROM users WHERE id = ?'
    ).get(request.user.id);

    if (!user) {
      return { error: 'Benutzer nicht gefunden' };
    }

    return { user };
  });

  // ============================================
  // API-Key Management (für Userscript)
  // ============================================

  /**
   * GET /api/auth/api-key
   * Aktuellen API-Key des Users abrufen (oder null wenn keiner existiert)
   */
  fastify.get('/api-key', {
    onRequest: [fastify.authenticate],
    schema: {
      description: 'API-Key abrufen',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const row = db.prepare('SELECT api_key FROM users WHERE id = ?').get(request.user.id);
    return { apiKey: row?.api_key || null };
  });

  /**
   * POST /api/auth/api-key
   * Neuen API-Key generieren (ersetzt eventuell vorhandenen)
   */
  fastify.post('/api-key', {
    onRequest: [fastify.authenticate],
    config: {
      rateLimit: { max: 5, timeWindow: '1 hour' },
    },
    schema: {
      description: 'Neuen API-Key generieren',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    const { randomUUID } = await import('crypto');
    const apiKey = `zj_${randomUUID().replace(/-/g, '')}`;
    db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(apiKey, request.user.id);
    return { apiKey };
  });

  /**
   * DELETE /api/auth/api-key
   * API-Key widerrufen
   */
  fastify.delete('/api-key', {
    onRequest: [fastify.authenticate],
    config: {
      rateLimit: { max: 5, timeWindow: '1 hour' },
    },
    schema: {
      description: 'API-Key widerrufen',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request) => {
    db.prepare('UPDATE users SET api_key = NULL WHERE id = ?').run(request.user.id);
    return { message: 'API-Key widerrufen.' };
  });
}
