/**
 * ============================================
 * Bring! Einkaufslisten-Integration
 * ============================================
 * Verbindet die App mit der Bring! Shopping-App,
 * um Einkaufslisten direkt dorthin zu senden.
 *
 * Nutzt das npm-Paket "bring-shopping" (MIT-Lizenz).
 */

import BringApi from 'bring-shopping';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import db from '../config/database.js';
import { config } from '../config/env.js';

// ============================================
// Verschlüsselung für Bring!-Passwörter
// ============================================
// Wir verwenden AES-256-GCM mit dem JWT-Secret als Key-Basis

function deriveKey() {
  // 32 Bytes Key aus JWT-Secret ableiten
  return createHash('sha256').update(config.jwt.secret).digest();
}

function encrypt(text) {
  const key = deriveKey();
  const iv = randomBytes(12); // 96 bit IV für GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText) {
  const key = deriveKey();
  const [ivHex, authTagHex, ciphertext] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ============================================
// Hilfsfunktion: Bring!-Client erstellen
// ============================================
async function createBringClient(userId) {
  const settings = db.prepare('SELECT * FROM bring_settings WHERE user_id = ?').get(userId);
  if (!settings) return null;

  const password = decrypt(settings.password_encrypted);
  const bring = new BringApi({ mail: settings.email, password });

  await bring.login();
  return { bring, settings };
}

// ============================================
// Routen
// ============================================
export default async function bringRoutes(app) {

  // ------------------------------------------
  // POST /connect - Bring!-Account verbinden
  // ------------------------------------------
  app.post('/connect', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          listUuid: { type: 'string' },   // Optional: gewünschte Liste
          listName: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password, listUuid, listName } = request.body;
    const userId = request.user.id;

    try {
      // Login bei Bring! testen
      const bring = new BringApi({ mail: email, password });
      await bring.login();

      // Listen laden, um eine Standard-Liste zu bestimmen
      const listsData = await bring.loadLists();
      const lists = listsData.lists || [];

      if (lists.length === 0) {
        return reply.status(400).send({ error: 'Keine Bring!-Listen gefunden. Erstelle zuerst eine Liste in der Bring!-App.' });
      }

      // Standard-Liste bestimmen (gewählte oder erste)
      let selectedList = lists[0];
      if (listUuid) {
        const found = lists.find(l => l.listUuid === listUuid);
        if (found) selectedList = found;
      }

      // Passwort verschlüsselt speichern
      const encryptedPassword = encrypt(password);

      db.prepare(`
        INSERT INTO bring_settings (user_id, email, password_encrypted, default_list_uuid, default_list_name, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          email = excluded.email,
          password_encrypted = excluded.password_encrypted,
          default_list_uuid = excluded.default_list_uuid,
          default_list_name = excluded.default_list_name,
          updated_at = CURRENT_TIMESTAMP
      `).run(userId, email, encryptedPassword, selectedList.listUuid, listName || selectedList.name || 'Einkaufsliste');

      return reply.send({
        success: true,
        message: `Bring!-Account verbunden (${email})`,
        list: {
          uuid: selectedList.listUuid,
          name: listName || selectedList.name || 'Einkaufsliste',
        },
        availableLists: lists.map(l => ({ uuid: l.listUuid, name: l.name || 'Einkaufsliste' })),
      });
    } catch (err) {
      console.error('Bring! Login fehlgeschlagen:', err.message);
      return reply.status(401).send({
        error: 'Bring!-Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.',
      });
    }
  });

  // ------------------------------------------
  // GET /status - Verbindungsstatus prüfen
  // ------------------------------------------
  app.get('/status', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.id;
    const settings = db.prepare('SELECT email, default_list_uuid, default_list_name, updated_at FROM bring_settings WHERE user_id = ?').get(userId);

    if (!settings) {
      return reply.send({ connected: false });
    }

    return reply.send({
      connected: true,
      email: settings.email,
      list: {
        uuid: settings.default_list_uuid,
        name: settings.default_list_name,
      },
      updatedAt: settings.updated_at,
    });
  });

  // ------------------------------------------
  // GET /lists - Verfügbare Bring!-Listen
  // ------------------------------------------
  app.get('/lists', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const client = await createBringClient(userId);
      if (!client) {
        return reply.status(400).send({ error: 'Bring! nicht verbunden. Bitte zuerst verbinden.' });
      }

      const listsData = await client.bring.loadLists();
      const lists = listsData.lists || [];

      return reply.send({
        lists: lists.map(l => ({
          uuid: l.listUuid,
          name: l.name || 'Einkaufsliste',
        })),
        defaultListUuid: client.settings.default_list_uuid,
      });
    } catch (err) {
      console.error('Bring! Listen laden fehlgeschlagen:', err.message);
      return reply.status(500).send({ error: 'Bring!-Listen konnten nicht geladen werden.' });
    }
  });

  // ------------------------------------------
  // PUT /list - Standard-Liste ändern
  // ------------------------------------------
  app.put('/list', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['listUuid'],
        properties: {
          listUuid: { type: 'string' },
          listName: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { listUuid, listName } = request.body;
    const userId = request.user.id;

    db.prepare(`
      UPDATE bring_settings SET default_list_uuid = ?, default_list_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(listUuid, listName || 'Einkaufsliste', userId);

    return reply.send({ success: true, message: 'Standard-Liste aktualisiert.' });
  });

  // ------------------------------------------
  // POST /send - Einkaufsliste an Bring! senden
  // ------------------------------------------
  app.post('/send', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          listUuid: { type: 'string' },   // Optional: andere Liste verwenden
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { listUuid } = request.body || {};

    try {
      const client = await createBringClient(userId);
      if (!client) {
        return reply.status(400).send({ error: 'Bring! nicht verbunden.' });
      }

      const targetListUuid = listUuid || client.settings.default_list_uuid;
      if (!targetListUuid) {
        return reply.status(400).send({ error: 'Keine Bring!-Liste ausgewählt.' });
      }

      // Aktive Einkaufsliste des Users laden
      const activeList = db.prepare(`
        SELECT id FROM shopping_lists WHERE user_id = ? AND is_active = 1
      `).get(userId);

      if (!activeList) {
        return reply.status(400).send({ error: 'Keine aktive Einkaufsliste vorhanden.' });
      }

      const items = db.prepare(`
        SELECT ingredient_name, amount, unit, is_checked,
               rewe_product_name, rewe_quantity, rewe_package_size
        FROM shopping_list_items
        WHERE shopping_list_id = ? AND is_checked = 0
      `).all(activeList.id);

      if (items.length === 0) {
        return reply.status(400).send({ error: 'Keine offenen Artikel auf der Einkaufsliste.' });
      }

      // Items an Bring! senden
      let sentCount = 0;
      const errors = [];

      for (const item of items) {
        try {
          // Spezifikation zusammenbauen:
          // Wenn REWE-Produkt zugeordnet → "2× Hochland Halloumi 250g"
          // Sonst → "2 Stk" (Menge + Einheit aus Einkaufsliste)
          let spec = '';
          const qty = item.rewe_quantity || 1;

          if (item.rewe_product_name) {
            // REWE-Produkt bekannt → präzise Angabe
            spec = qty > 1 ? `${qty}× ` : '';
            spec += item.rewe_product_name;
            if (item.rewe_package_size) spec += ` (${item.rewe_package_size})`;
          } else if (item.amount) {
            spec = `${item.amount}`;
            if (item.unit) spec += ` ${item.unit}`;
          } else if (item.unit) {
            spec = item.unit;
          }

          await client.bring.saveItem(targetListUuid, item.ingredient_name, spec);
          sentCount++;

          // Kleine Pause, um die Bring!-API nicht zu überlasten
          await new Promise(r => setTimeout(r, 150));
        } catch (err) {
          errors.push({ item: item.ingredient_name, error: err.message });
        }
      }

      return reply.send({
        success: true,
        message: `${sentCount} von ${items.length} Artikeln an Bring! gesendet.`,
        sentCount,
        totalCount: items.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      console.error('Bring! Senden fehlgeschlagen:', err.message);
      return reply.status(500).send({ error: 'Artikel konnten nicht an Bring! gesendet werden.' });
    }
  });

  // ------------------------------------------
  // DELETE /disconnect - Bring! trennen
  // ------------------------------------------
  app.delete('/disconnect', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.user.id;
    db.prepare('DELETE FROM bring_settings WHERE user_id = ?').run(userId);
    return reply.send({ success: true, message: 'Bring!-Verbindung getrennt.' });
  });
}
