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
   * Sendet eine Anfrage und erwartet JSON zurück
   * @param {string} prompt - Der Prompt/die Anfrage
   * @param {object} options - Zusätzliche Optionen
   * @returns {Promise<object>} - Geparste JSON-Antwort
   */
  async chatJSON(prompt, options = {}) {
    const response = await this.chat(
      prompt + '\n\nAntworte ausschließlich mit validem JSON, ohne Markdown-Formatierung oder andere Zeichen.',
      options
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
      options
    );
    return this.parseJSON(response);
  }

  /**
   * Extrahiert JSON aus einer KI-Antwort
   * Unterstützt auch JSON in Markdown-Code-Blöcken
   */
  parseJSON(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim());
      }
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        return JSON.parse(braceMatch[0]);
      }
      const bracketMatch = text.match(/\[[\s\S]*\]/);
      if (bracketMatch) {
        return JSON.parse(bracketMatch[0]);
      }
      throw new Error(`Konnte kein JSON aus KI-Antwort extrahieren: ${text.substring(0, 200)}...`);
    }
  }
}
