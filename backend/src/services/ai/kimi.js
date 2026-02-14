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
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
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
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API Fehler (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Sendet eine Chat-Anfrage mit Bild (Vision)
   * Kimi 2.5 unterstützt multimodale Eingaben über die OpenAI-kompatible API
   */
  async chatWithImage(prompt, imageBuffer, options = {}) {
    // Bild zu Base64 konvertieren
    const base64Image =
      imageBuffer instanceof Buffer
        ? imageBuffer.toString('base64')
        : imageBuffer;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'Du bist ein hilfreicher Kochassistent. Analysiere Bilder von Rezepten und extrahiere alle relevanten Informationen. Antworte immer auf Deutsch.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi Vision API Fehler (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
