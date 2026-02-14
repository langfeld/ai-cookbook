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
  /**
   * POST /api/auth/register
   * Neuen Benutzer registrieren
   */
  fastify.post('/register', {
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

    // Benutzer anlegen
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
    ).run(username, email, passwordHash, display_name || username);

    const userId = result.lastInsertRowid;

    // Standard-Kategorien für den neuen User anlegen
    createDefaultCategories(userId);

    // JWT Token generieren
    const token = fastify.jwt.sign({
      id: userId,
      username,
      role: 'user',
    });

    return reply.status(201).send({
      message: 'Registrierung erfolgreich!',
      token,
      user: {
        id: userId,
        username,
        email,
        display_name: display_name || username,
        role: 'user',
      },
    });
  });

  /**
   * POST /api/auth/login
   * Benutzer anmelden
   */
  fastify.post('/login', {
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
}
