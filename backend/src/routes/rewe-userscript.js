/**
 * ============================================
 * REWE Userscript Route
 * ============================================
 * Eigenes Plugin, OHNE Auth-Hook.
 * Wird separat von den REWE-Routen registriert,
 * damit der globale authenticate-Hook nicht greift.
 * Auth erfolgt manuell über ?token= Query-Parameter.
 */

import db from '../config/database.js';

export default async function reweUserscriptRoute(fastify) {

  /**
   * GET /api/rewe/userscript.user.js
   * Generiert ein Tampermonkey/Greasemonkey/ViolentMonkey-Userscript.
   * Auth über ?token= Query-Parameter (JWT) – nur für die Erstinstallation.
   * Das Userscript selbst nutzt danach einen dauerhaften API-Key aus GM_getValue.
   * URL endet auf .user.js → Userscript-Manager erkennt es automatisch.
   */
  fastify.get('/userscript.user.js', {
    schema: {
      description: 'Tampermonkey/Greasemonkey Userscript für REWE-Warenkorb',
      tags: ['REWE'],
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    // Token manuell verifizieren (nicht über globalen Hook)
    let user;
    try {
      const decoded = fastify.jwt.verify(request.query.token);
      user = decoded;
    } catch {
      return reply.status(401).send('// Ungültiger oder abgelaufener Token. Bitte Userscript neu generieren.');
    }

    // API-URL aus dem Request ableiten
    const proto = request.headers['x-forwarded-proto'] || request.protocol;
    const host = request.headers['x-forwarded-host'] || request.headers.host;
    const apiBaseUrl = `${proto}://${host}/api`;

    // API-Key des Users abrufen (oder neuen generieren)
    const { randomUUID } = await import('crypto');
    let row = db.prepare('SELECT api_key FROM users WHERE id = ?').get(user.id);
    let apiKey = row?.api_key;
    if (!apiKey) {
      apiKey = `zj_${randomUUID().replace(/-/g, '')}`;
      db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(apiKey, user.id);
    }

    const script = generateReweUserscript(apiBaseUrl, apiKey);

    reply
      .type('text/javascript; charset=utf-8')
      .send(script);
  });
}

/**
 * Generiert ein Tampermonkey/Greasemonkey-Userscript für REWE.
 *
 * Features:
 * - Floating-Button auf rewe.de mit Einkaufslisten-Integration
 * - Holt die aktuelle Einkaufsliste per GM_xmlhttpRequest (Cross-Origin)
 * - Fügt Produkte per Listing-ID-Verfahren in den REWE-Warenkorb
 * - Zeigt Fortschritt und Ergebnis in einem Panel auf der Seite
 * - Einmal installieren, immer aktuell (holt Daten live vom Server)
 */
function generateReweUserscript(apiBaseUrl, apiKey) {
  // Hostname aus der API-URL extrahieren für @connect
  let apiHost;
  try { apiHost = new URL(apiBaseUrl).hostname; } catch { apiHost = '*'; }

  return `// ==UserScript==
// @name         Zauberjournal → REWE Warenkorb
// @namespace    zauberjournal-rewe
// @version      1.2
// @description  Einkaufsliste aus dem Zauberjournal automatisch in den REWE-Warenkorb legen
// @author       Zauberjournal
// @match        https://shop.rewe.de/*
// @match        https://www.rewe.de/*
// @icon         https://www.rewe.de/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      ${apiHost}
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  /* ─── Konfiguration ─── */
  const API_BASE = '${apiBaseUrl}';

  /* API-Key: Beim ersten Install wird der Key aus dem Script eingebettet.
     Danach wird er in GM_storage gespeichert und kann jederzeit aktualisiert werden. */
  const EMBEDDED_KEY = '${apiKey}';
  if (EMBEDDED_KEY && !GM_getValue('zj_api_key', '')) {
    GM_setValue('zj_api_key', EMBEDDED_KEY);
  }

  function getApiKey() {
    return GM_getValue('zj_api_key', '');
  }

  /* ─── Styles ─── */
  GM_addStyle(\`
    #ac-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 999990;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #c75b52, #a8473f);
      color: white; border: none; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      font-size: 24px; display: flex; align-items: center; justify-content: center;
      transition: all 0.3s ease;
      font-family: system-ui, -apple-system, sans-serif;
    }
    #ac-fab:hover { transform: scale(1.1); box-shadow: 0 6px 24px rgba(0,0,0,0.4); }
    #ac-fab .ac-badge {
      position: absolute; top: -4px; right: -4px;
      background: #16a34a; color: white; font-size: 11px; font-weight: 700;
      width: 22px; height: 22px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid white;
    }

    #ac-panel {
      position: fixed; bottom: 92px; right: 24px; z-index: 999991;
      width: 380px; max-height: 70vh;
      background: white; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      font-family: system-ui, -apple-system, sans-serif;
      display: none; flex-direction: column; overflow: hidden;
      animation: ac-slide-up 0.25s ease-out;
    }
    @keyframes ac-slide-up {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #ac-panel.ac-open { display: flex; }

    #ac-panel-header {
      background: linear-gradient(135deg, #c75b52, #a8473f);
      color: white; padding: 16px 20px;
      display: flex; align-items: center; justify-content: space-between;
    }
    #ac-panel-header h3 { margin: 0; font-size: 15px; font-weight: 700; }
    #ac-panel-header .ac-subtitle { font-size: 11px; opacity: 0.8; margin-top: 2px; }
    #ac-panel-close {
      background: rgba(255,255,255,0.2); border: none; color: white;
      width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
      font-size: 16px; display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    #ac-panel-close:hover { background: rgba(255,255,255,0.3); }

    #ac-panel-body { flex: 1; overflow-y: auto; padding: 0; }

    .ac-status {
      padding: 16px 20px; text-align: center; color: #666; font-size: 13px;
    }
    .ac-status .ac-spinner {
      display: inline-block; width: 20px; height: 20px;
      border: 2px solid #ddd; border-top-color: #c75b52;
      border-radius: 50%; animation: ac-spin 0.8s linear infinite;
      margin-bottom: 8px;
    }
    @keyframes ac-spin { to { transform: rotate(360deg); } }

    .ac-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 20px; border-bottom: 1px solid #f0f0f0;
      font-size: 13px;
    }
    .ac-item:last-child { border-bottom: none; }
    .ac-item-icon {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; flex-shrink: 0;
    }
    .ac-item-icon.ac-pending { background: #f5f5f5; }
    .ac-item-icon.ac-ok { background: #dcfce7; }
    .ac-item-icon.ac-err { background: #fee2e2; }
    .ac-item-icon.ac-skip { background: #fef3c7; }
    .ac-item-name { flex: 1; color: #333; }
    .ac-item-qty { color: #999; font-size: 11px; white-space: nowrap; }
    .ac-item-price { color: #16a34a; font-weight: 600; font-size: 12px; white-space: nowrap; }

    #ac-panel-footer {
      padding: 16px 20px; border-top: 1px solid #eee;
      display: flex; flex-direction: column; gap: 8px;
    }
    .ac-btn {
      width: 100%; padding: 12px; border: none; border-radius: 10px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.2s;
    }
    .ac-btn-primary {
      background: linear-gradient(135deg, #c75b52, #a8473f);
      color: white;
    }
    .ac-btn-primary:hover { filter: brightness(1.1); }
    .ac-btn-primary:disabled {
      opacity: 0.5; cursor: not-allowed; filter: none;
    }
    .ac-btn-secondary {
      background: #f5f5f5; color: #333;
    }
    .ac-btn-secondary:hover { background: #eee; }

    .ac-result-banner {
      padding: 12px 20px; text-align: center;
      font-size: 13px; font-weight: 600;
    }
    .ac-result-ok { background: #dcfce7; color: #166534; }
    .ac-result-err { background: #fee2e2; color: #991b1b; }
    .ac-result-partial { background: #fef3c7; color: #92400e; }

    .ac-total {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 20px; background: #fafafa; font-size: 13px;
    }
    .ac-total-label { color: #666; }
    .ac-total-value { font-weight: 700; color: #333; font-size: 15px; }

    .ac-error-box {
      margin: 16px 20px; padding: 12px 16px;
      background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 10px; color: #991b1b; font-size: 12px;
      text-align: center;
    }
    .ac-error-box a {
      color: #c75b52; text-decoration: underline; cursor: pointer;
    }

    .ac-option-row {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 20px; font-size: 12px; color: #666;
    }
    .ac-toggle {
      position: relative; width: 36px; height: 20px; flex-shrink: 0;
    }
    .ac-toggle input {
      opacity: 0; width: 0; height: 0; position: absolute;
    }
    .ac-toggle-slider {
      position: absolute; inset: 0; border-radius: 10px;
      background: #ccc; cursor: pointer; transition: background 0.2s;
    }
    .ac-toggle-slider::before {
      content: ''; position: absolute;
      width: 16px; height: 16px; border-radius: 50%;
      left: 2px; top: 2px; background: white;
      transition: transform 0.2s;
    }
    .ac-toggle input:checked + .ac-toggle-slider {
      background: #c75b52;
    }
    .ac-toggle input:checked + .ac-toggle-slider::before {
      transform: translateX(16px);
    }
    .ac-option-label {
      cursor: pointer; user-select: none;
    }
  \`);

  /* ─── State ─── */
  let products = [];
  let panelOpen = false;
  let isAdding = false;
  let autoCheckout = GM_getValue('ac_auto_checkout', true); // default: true

  /* ─── DOM ─── */

  // Floating Action Button
  const fab = document.createElement('button');
  fab.id = 'ac-fab';
  fab.innerHTML = '🍳';
  fab.title = 'Zauberjournal – Einkaufsliste';
  fab.onclick = togglePanel;
  document.body.appendChild(fab);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'ac-panel';
  panel.innerHTML = \`
    <div id="ac-panel-header">
      <div>
        <h3>🍳 Zauberjournal</h3>
        <div class="ac-subtitle">Einkaufsliste → REWE Warenkorb</div>
      </div>
      <button id="ac-panel-close" title="Schließen">✕</button>
    </div>
    <div id="ac-panel-body">
      <div class="ac-status" id="ac-status">
        <div class="ac-spinner"></div><br>Lade Einkaufsliste...
      </div>
    </div>
    <div id="ac-panel-footer"></div>
  \`;
  document.body.appendChild(panel);

  // Event-Listener
  document.getElementById('ac-panel-close').onclick = () => togglePanel();

  /* ─── Funktionen ─── */

  function togglePanel() {
    panelOpen = !panelOpen;
    panel.classList.toggle('ac-open', panelOpen);
    if (panelOpen && !products.length && !isAdding) {
      loadProducts();
    }
  }

  function setStatus(html) {
    document.getElementById('ac-status').innerHTML = html;
  }

  function updateBadge(count) {
    let badge = fab.querySelector('.ac-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ac-badge';
        fab.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  }

  /* ─── API-Aufruf (Cross-Origin via GM_xmlhttpRequest) ─── */
  function apiGet(path) {
    return new Promise((resolve, reject) => {
      const key = getApiKey();
      if (!key) {
        reject(new Error('NO_API_KEY'));
        return;
      }
      GM_xmlhttpRequest({
        method: 'GET',
        url: API_BASE + path,
        headers: {
          'X-API-Key': key,
          'Accept': 'application/json',
        },
        onload(response) {
          if (response.status === 401) {
            reject(new Error('TOKEN_EXPIRED'));
            return;
          }
          if (response.status >= 400) {
            reject(new Error('HTTP ' + response.status));
            return;
          }
          try {
            resolve(JSON.parse(response.responseText));
          } catch(e) {
            reject(new Error('Ungültige Antwort vom Server'));
          }
        },
        onerror(err) {
          reject(new Error('Server nicht erreichbar'));
        },
        ontimeout() {
          reject(new Error('Zeitüberschreitung'));
        },
        timeout: 15000,
      });
    });
  }

  /* ─── Einkaufsliste vom Server laden ─── */
  async function loadProducts() {
    const body = document.getElementById('ac-panel-body');
    const footer = document.getElementById('ac-panel-footer');

    setStatus('<div class="ac-spinner"></div><br>Lade Einkaufsliste...');
    footer.innerHTML = '';

    try {
      const data = await apiGet('/rewe/cart-script');

      if (data.error) {
        setStatus('<div class="ac-error-box">' + escapeHtml(data.error) + '</div>');
        footer.innerHTML = '<button class="ac-btn ac-btn-secondary" onclick="document.getElementById(\\'ac-btn-load\\').click()">🔄 Erneut versuchen</button>';
        return;
      }

      products = data.products || [];

      if (!products.length) {
        setStatus('<div class="ac-error-box">Keine REWE-Produkte in der Einkaufsliste zugeordnet.<br>Bitte zuerst im Zauberjournal mit REWE matchen.</div>');
        footer.innerHTML = \`<button class="ac-btn ac-btn-secondary" id="ac-btn-load">🔄 Erneut laden</button>\`;
        document.getElementById('ac-btn-load').onclick = loadProducts;
        return;
      }

      updateBadge(products.length);
      renderProducts();

    } catch(err) {
      if (err.message === 'TOKEN_EXPIRED' || err.message === 'NO_API_KEY') {
        showApiKeyDialog(err.message === 'NO_API_KEY'
          ? 'Kein API-Key hinterlegt.'
          : 'API-Key ungültig oder widerrufen.');
      } else {
        setStatus('<div class="ac-error-box">❌ ' + escapeHtml(err.message) + '<br><br>Ist der Zauberjournal Server erreichbar?</div>');
      }
      footer.innerHTML = \`<button class="ac-btn ac-btn-secondary" id="ac-btn-load">🔄 Erneut versuchen</button>\`;
      document.getElementById('ac-btn-load').onclick = loadProducts;
    }
  }

  /* ─── Produkte rendern ─── */
  function renderProducts() {
    const body = document.getElementById('ac-panel-body');
    const footer = document.getElementById('ac-panel-footer');

    // Gesamtpreis berechnen
    const totalCents = products.reduce((s, p) => s + ((p.price || 0) * (p.quantity || 1)), 0);
    const totalPackages = products.reduce((s, p) => s + (p.quantity || 1), 0);

    let html = '';

    // Preis-Übersicht
    html += '<div class="ac-total">';
    html += '<span class="ac-total-label">' + products.length + ' Produkte · ' + totalPackages + ' Packungen</span>';
    html += '<span class="ac-total-value">' + (totalCents / 100).toFixed(2).replace('.', ',') + ' €</span>';
    html += '</div>';

    // Produkt-Liste
    products.forEach((p, i) => {
      const qty = p.quantity || 1;
      const qtyLabel = qty > 1 ? qty + '×' : '';
      const price = p.price ? (p.price / 100).toFixed(2).replace('.', ',') + ' €' : '';
      const totalPrice = p.price && qty > 1 ? ((p.price * qty) / 100).toFixed(2).replace('.', ',') + ' €' : price;

      html += '<div class="ac-item" id="ac-item-' + i + '">';
      html += '<div class="ac-item-icon ac-pending" id="ac-icon-' + i + '">🛒</div>';
      html += '<span class="ac-item-name">' + (qtyLabel ? '<strong>' + qtyLabel + '</strong> ' : '') + escapeHtml(p.name) + '</span>';
      if (totalPrice) html += '<span class="ac-item-price">' + totalPrice + '</span>';
      html += '</div>';
    });

    body.innerHTML = html;

    // Footer mit Buttons
    footer.innerHTML = \`
      <button class="ac-btn ac-btn-primary" id="ac-btn-add">
        🛒 Alle in den Warenkorb legen
      </button>
      <div class="ac-option-row">
        <label class="ac-toggle">
          <input type="checkbox" id="ac-auto-checkout" \${autoCheckout ? 'checked' : ''}>
          <span class="ac-toggle-slider"></span>
        </label>
        <label class="ac-option-label" for="ac-auto-checkout">
          Nach dem Hinzufügen zum Warenkorb wechseln
        </label>
      </div>
      <button class="ac-btn ac-btn-secondary" id="ac-btn-reload">
        🔄 Liste neu laden
      </button>
    \`;

    document.getElementById('ac-btn-add').onclick = addAllToCart;
    document.getElementById('ac-btn-reload').onclick = loadProducts;
    document.getElementById('ac-auto-checkout').onchange = (e) => {
      autoCheckout = e.target.checked;
      GM_setValue('ac_auto_checkout', autoCheckout);
    };
  }

  /* ─── Alle Produkte in den REWE-Warenkorb ─── */
  async function addAllToCart() {
    if (isAdding) return;
    isAdding = true;

    const addBtn = document.getElementById('ac-btn-add');
    addBtn.disabled = true;
    addBtn.innerHTML = '<div class="ac-spinner" style="width:16px;height:16px;border-width:2px;margin:0"></div> Wird hinzugefügt...';

    let added = 0, failed = 0, skipped = 0;
    const errors = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const qty = p.quantity || 1;
      const icon = document.getElementById('ac-icon-' + i);

      // Aktiven Zustand anzeigen
      if (icon) {
        icon.className = 'ac-item-icon ac-pending';
        icon.textContent = '⏳';
      }

      try {
        /* Schritt 1: Produktseite laden → Listing-ID extrahieren */
        const pageRes = await fetch('/shop/p/' + p.id, {
          credentials: 'include',
          headers: { 'Accept': 'text/html' },
        });

        if (!pageRes.ok) throw new Error('Produktseite Status ' + pageRes.status);

        const html = await pageRes.text();
        const listingMatch = html.match(/data-listingid="([^"]+)"/)
                          || html.match(/"listingId"\\\\s*:\\\\s*"([^"]+)"/);

        if (!listingMatch) throw new Error('Keine Listing-ID (Markt gewählt?)');

        const listingId = listingMatch[1];

        /* Schritt 2: In den Warenkorb legen */
        const cartRes = await fetch('/shop/api/baskets/listings/' + encodeURIComponent(listingId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: qty, includeTimeslot: false, context: 'product-detail' }),
          credentials: 'include',
        });

        if (cartRes.ok) {
          added++;
          if (icon) { icon.className = 'ac-item-icon ac-ok'; icon.textContent = '✅'; }
        } else if (cartRes.status === 409) {
          skipped++;
          if (icon) { icon.className = 'ac-item-icon ac-skip'; icon.textContent = '⚠️'; }
        } else {
          throw new Error('API Status ' + cartRes.status);
        }

      } catch(e) {
        failed++;
        errors.push({ name: p.name, error: e.message });
        if (icon) { icon.className = 'ac-item-icon ac-err'; icon.textContent = '❌'; }
      }

      /* Pause zwischen Produkten */
      await new Promise(r => setTimeout(r, 500));
    }

    isAdding = false;

    /* Ergebnis-Banner */
    const body = document.getElementById('ac-panel-body');
    const banner = document.createElement('div');

    if (failed === 0) {
      banner.className = 'ac-result-banner ac-result-ok';
      let msg = '✅ ' + added + ' Produkt' + (added !== 1 ? 'e' : '') + ' hinzugefügt!';
      if (skipped) msg += ' (' + skipped + ' waren schon drin)';
      banner.textContent = msg;
    } else if (added > 0) {
      banner.className = 'ac-result-banner ac-result-partial';
      banner.textContent = '⚠️ ' + added + ' hinzugefügt, ' + failed + ' fehlgeschlagen';
    } else {
      banner.className = 'ac-result-banner ac-result-err';
      banner.textContent = '❌ Alle ' + failed + ' Produkte fehlgeschlagen';
    }

    body.insertBefore(banner, body.firstChild);

    /* Footer aktualisieren */
    const footer = document.getElementById('ac-panel-footer');
    footer.innerHTML = \`
      <button class="ac-btn ac-btn-secondary" id="ac-btn-reload">
        🔄 Liste neu laden
      </button>
    \`;
    document.getElementById('ac-btn-reload').onclick = loadProducts;

    /* Badge aktualisieren */
    updateBadge(0);

    /* Auto-Checkout: Zum Warenkorb wechseln wenn aktiviert und mindestens ein Produkt hinzugefügt */
    if (autoCheckout && added > 0) {
      setTimeout(() => {
        window.location.href = 'https://www.rewe.de/shop/checkout/basket';
      }, 1500);
    }
  }

  /* ─── API-Key-Eingabe-Dialog ─── */
  function showApiKeyDialog(reason) {
    const body = document.getElementById('ac-panel-body');
    const footer = document.getElementById('ac-panel-footer');

    body.innerHTML = \`
      <div style="padding: 20px;">
        <div class="ac-error-box" style="margin: 0 0 16px 0;">
          🔑 \${reason}<br><br>
          Bitte gib deinen API-Key ein.<br>
          Du findest ihn in den Zauberjournal REWE-Einstellungen.
        </div>
        <input type="text" id="ac-apikey-input" placeholder="zj_..."
          style="width: 100%; padding: 10px 12px; border: 2px solid #ddd; border-radius: 8px;
                font-family: monospace; font-size: 13px; box-sizing: border-box;
                outline: none; transition: border-color 0.2s;"
          onfocus="this.style.borderColor='#c75b52'"
          onblur="this.style.borderColor='#ddd'">
        <div id="ac-apikey-error" style="color: #991b1b; font-size: 12px; margin-top: 6px; display: none;"></div>
      </div>
    \`;

    footer.innerHTML = \`
      <button class="ac-btn ac-btn-primary" id="ac-btn-save-key">
        💾 API-Key speichern
      </button>
    \`;

    const input = document.getElementById('ac-apikey-input');
    const errorEl = document.getElementById('ac-apikey-error');

    // Aktuellen Key vorausfüllen (falls vorhanden)
    const currentKey = getApiKey();
    if (currentKey) input.value = currentKey;

    document.getElementById('ac-btn-save-key').onclick = () => {
      const newKey = input.value.trim();
      if (!newKey) {
        errorEl.textContent = 'Bitte einen API-Key eingeben.';
        errorEl.style.display = 'block';
        return;
      }
      if (!newKey.startsWith('zj_')) {
        errorEl.textContent = 'Ungültiges Format. Der Key muss mit "zj_" beginnen.';
        errorEl.style.display = 'block';
        return;
      }
      errorEl.style.display = 'none';
      GM_setValue('zj_api_key', newKey);
      // Erneut laden mit neuem Key
      products = [];
      loadProducts();
    };

    // Enter-Taste zum Speichern
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('ac-btn-save-key').click();
    });

    // Panel öffnen falls geschlossen
    if (!panelOpen) togglePanel();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  console.log('%c🍳 Zauberjournal Userscript geladen!', 'color:#c75b52;font-weight:bold;font-size:14px');
  console.log('%c   Klicke auf den 🍳-Button unten rechts.', 'color:#666');
})();
`;
}
