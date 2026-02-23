/**
 * ============================================
 * Kimi / Moonshot AI Provider
 * ============================================
 * Implementiert die KI-Anbindung an Moonshot AI.
 * Unterstützt zwei Modell-Typen:
 *   - Reasoning: kimi-k2.5 (erzwingt temperature=1, liefert reasoning_content)
 *   - Standard:  moonshot-v1-8k/32k/128k (freie temperature, schneller, günstiger)
 *
 * Alle Modelle nutzen die OpenAI-kompatible API.
 * Dokumentation: https://platform.moonshot.cn/docs
 */

import { BaseAIProvider } from './base.js';

export class KimiProvider extends BaseAIProvider {
  constructor(config) {
    super('Kimi / Moonshot AI');
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.moonshot.cn/v1';
    this.model = config.model || 'kimi-k2.5';

    if (!this.apiKey) {
      console.warn('⚠️  KIMI_API_KEY nicht gesetzt! KI-Funktionen werden nicht verfügbar sein.');
    }
  }

  /**
   * Prüft ob das aktuelle Modell ein Reasoning-Modell ist.
   * Reasoning-Modelle (kimi-k2.5, kimi-k2) erzwingen temperature=1
   * und liefern `reasoning_content` statt/neben `content`.
   * Standard-Modelle (moonshot-v1-*) erlauben freie temperature.
   */
  get isReasoningModel() {
    return /^kimi-k/i.test(this.model);
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

    // Reasoning-Modelle (kimi-k2.5) erzwingen temperature=1
    // Standard-Modelle (moonshot-v1-*) erlauben freie temperature
    if (!this.isReasoningModel && options.temperature != null) {
      body.temperature = options.temperature;
    }
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
    // Reasoning-Modelle liefern `content` + `reasoning_content`.
    // Standard-Modelle liefern nur `content`.
    if (message.content) return message.content;
    if (this.isReasoningModel) {
      if (!options.json && message.reasoning_content) return message.reasoning_content;
      throw new Error('Kimi hat keine verwertbare Antwort zurückgegeben (Reasoning-Modell). Bitte max_tokens erhöhen.');
    }
    throw new Error('Kimi hat keine Antwort zurückgegeben.');
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

    if (!this.isReasoningModel && options.temperature != null) {
      body.temperature = options.temperature;
    }
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
    if (message.content) return message.content;
    if (this.isReasoningModel) {
      if (!options.json && message.reasoning_content) return message.reasoning_content;
      throw new Error('Kimi hat keine verwertbare Antwort zurückgegeben (Reasoning-Modell). Bitte max_tokens erhöhen.');
    }
    throw new Error('Kimi hat keine Antwort zurückgegeben.');
  }
}
