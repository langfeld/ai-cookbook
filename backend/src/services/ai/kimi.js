/**
 * ============================================
 * Kimi 2.5 (Moonshot AI) Provider
 * ============================================
 * Implementiert die KI-Anbindung an Kimi 2.5 von Moonshot AI.
 * Kimi verwendet eine OpenAI-kompatible API.
 *
 * Dokumentation: https://platform.moonshot.cn/docs
 */

import { BaseAIProvider } from './base.js';

export class KimiProvider extends BaseAIProvider {
  constructor(config) {
    super('Kimi 2.5 (Moonshot AI)');
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.moonshot.cn/v1';
    this.model = config.model || 'kimi-2.5';

    if (!this.apiKey) {
      console.warn('⚠️  KIMI_API_KEY nicht gesetzt! KI-Funktionen werden nicht verfügbar sein.');
    }
  }

  /**
   * Sendet eine Chat-Anfrage an die Kimi API
   */
  async chat(prompt, options = {}) {
    const body = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'Du bist ein hilfreicher Kochassistent. Du antwortest immer auf Deutsch und bist Experte für Rezepte, Zutaten, Kochtechniken und Wochenplanung.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: options.maxTokens ?? 4096,
    };

    // Kimi K2.5 erlaubt nur temperature=1, daher nicht setzen
    if (options.json) body.response_format = { type: 'json_object' };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API Fehler (${response.status}): ${error}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;
    // Kimi K2.5 ist ein Reasoning-Modell: Die Antwort steht in `content`,
    // das interne Denken in `reasoning_content`. Falls `content` leer ist
    // (z.B. weil max_tokens für das Reasoning aufgebraucht wurden),
    // verwenden wir `reasoning_content` als Fallback.
    return message.content || message.reasoning_content || '';
  }

  /**
   * Sendet eine Chat-Anfrage mit mehreren Bildern (Vision)
   * Kimi K2.5 unterstützt mehrere Bilder in einer Nachricht
   */
  async chatWithImages(prompt, imageBuffers, options = {}) {
    const contentParts = imageBuffers.map((buf) => {
      const base64 = buf instanceof Buffer ? buf.toString('base64') : buf;
      return {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${base64}` },
      };
    });
    contentParts.push({ type: 'text', text: prompt });

    const body = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'Du bist ein hilfreicher Kochassistent. Analysiere Bilder von Rezepten und extrahiere alle relevanten Informationen. Wenn mehrere Bilder gesendet werden, gehören sie zum selben Rezept (z.B. Vorder- und Rückseite einer Rezeptkarte). Kombiniere die Informationen zu einem einzigen vollständigen Rezept. Antworte immer auf Deutsch.',
        },
        {
          role: 'user',
          content: contentParts,
        },
      ],
      max_tokens: options.maxTokens ?? 4096,
    };

    // Kimi K2.5 erlaubt nur temperature=1, daher nicht setzen
    if (options.json) body.response_format = { type: 'json_object' };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi Vision API Fehler (${response.status}): ${error}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;
    return message.content || message.reasoning_content || '';
  }
}
