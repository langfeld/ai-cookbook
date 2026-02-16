/**
 * ============================================
 * BaseAIProvider - Abstrakte Basisklasse
 * ============================================
 * Definiert die Schnittstelle, die jeder AI-Provider implementieren muss.
 * In eigener Datei, um zirkuläre Imports zu vermeiden.
 */

export class BaseAIProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Sendet eine Textanfrage an die KI
   * @param {string} prompt - Der Prompt/die Anfrage
   * @param {object} options - Zusätzliche Optionen (temperature, max_tokens, etc.)
   * @returns {Promise<string>} - Die Antwort der KI
   */
  async chat(prompt, options = {}) {
    throw new Error(`chat() nicht implementiert für Provider: ${this.name}`);
  }

  /**
   * Sendet eine Anfrage mit Bild an die KI (Vision/Multimodal)
   * @param {string} prompt - Der Prompt/die Anfrage
   * @param {Buffer|string} image - Bild als Buffer oder Base64-String
   * @param {object} options - Zusätzliche Optionen
   * @returns {Promise<string>} - Die Antwort der KI
   */
  async chatWithImage(prompt, image, options = {}) {
    throw new Error(`chatWithImage() nicht implementiert für Provider: ${this.name}`);
  }

  /**
   * Sendet eine Anfrage mit mehreren Bildern an die KI (Multi-Page)
   * Fallback: Ruft chatWithImage für jedes Bild einzeln auf und kombiniert
   */
  async chatWithImages(prompt, images, options = {}) {
    // Default-Implementierung: Einzelbild-Fallback
    if (images.length === 1) {
      return this.chatWithImage(prompt, images[0], options);
    }
    throw new Error(`chatWithImages() nicht implementiert für Provider: ${this.name}`);
  }

  /**
   * Sendet eine Anfrage und erwartet JSON zurück
   */
  async chatJSON(prompt, options = {}) {
    const response = await this.chat(
      prompt + '\n\nAntworte ausschließlich mit validem JSON, ohne Markdown-Formatierung oder andere Zeichen.',
      { ...options, json: true }
    );
    return this.parseJSON(response);
  }

  /**
   * Sendet eine Anfrage mit Bild und erwartet JSON zurück
   */
  async chatWithImageJSON(prompt, image, options = {}) {
    const response = await this.chatWithImage(
      prompt + '\n\nAntworte ausschließlich mit validem JSON, ohne Markdown-Formatierung oder andere Zeichen.',
      image,
      { ...options, json: true }
    );
    return this.parseJSON(response);
  }

  /**
   * Sendet eine Anfrage mit mehreren Bildern und erwartet JSON zurück
   */
  async chatWithImagesJSON(prompt, images, options = {}) {
    const response = await this.chatWithImages(
      prompt + '\n\nAntworte ausschließlich mit validem JSON, ohne Markdown-Formatierung oder andere Zeichen.',
      images,
      { ...options, json: true }
    );
    return this.parseJSON(response);
  }

  /**
   * Extrahiert JSON aus einer KI-Antwort
   * Unterstützt Markdown-Code-Blöcke und repariert abgeschnittenes JSON
   */
  parseJSON(text) {
    // 1. Direkt versuchen
    try {
      return JSON.parse(text);
    } catch {}

    // 2. Markdown-Codeblock entfernen
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {}
    }

    // 3. Äußerstes JSON-Objekt oder -Array extrahieren
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {}
    }

    const bracketMatch = text.match(/\[[\s\S]*\]/);
    if (bracketMatch) {
      try {
        return JSON.parse(bracketMatch[0]);
      } catch {}
    }

    // 4. Abgeschnittenes JSON reparieren (wenn max_tokens erreicht wurde)
    let candidate = text;
    // Markdown-Prefix entfernen
    candidate = candidate.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    // Versuche ab { oder [ zu starten
    const startBrace = candidate.indexOf('{');
    const startBracket = candidate.indexOf('[');
    const startIdx = startBrace >= 0 && (startBracket < 0 || startBrace < startBracket)
      ? startBrace : startBracket;
    if (startIdx >= 0) {
      candidate = candidate.substring(startIdx);
    }
    // Trailing-Komma und unvollständige Werte entfernen
    candidate = candidate
      .replace(/,\s*"[^"]*":\s*"?[^"}\]]*$/, '')  // unvollständiges Key-Value am Ende
      .replace(/,\s*\{[^}]*$/, '')                  // unvollständiges Objekt in Array
      .replace(/,\s*"[^"]*$/, '')                    // unvollständiger String in Array
      .replace(/,\s*$/, '');                          // trailing Komma
    // Fehlende schließende Klammern ergänzen
    const opens = (candidate.match(/[\[{]/g) || []).length;
    const closes = (candidate.match(/[\]}]/g) || []).length;
    const missing = opens - closes;
    if (missing > 0) {
      // Klammern in umgekehrter Öffnungsreihenfolge schließen
      const stack = [];
      for (const ch of candidate) {
        if (ch === '{') stack.push('}');
        else if (ch === '[') stack.push(']');
        else if (ch === '}' || ch === ']') stack.pop();
      }
      candidate += stack.reverse().join('');
    }
    try {
      return JSON.parse(candidate);
    } catch {}

    console.error('[AI] JSON-Parsing fehlgeschlagen. Vollständige KI-Antwort:\n', text);
    throw new Error(`Konnte kein JSON aus KI-Antwort extrahieren: ${text.substring(0, 300)}...`);
  }
}
