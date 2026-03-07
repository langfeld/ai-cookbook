/**
 * ============================================
 * Kimi / Moonshot AI Provider
 * ============================================
 * Implementiert die KI-Anbindung an Moonshot AI.
 * Unterstützt drei Modell-Varianten:
 *   - Kimi K2.5 Thinking: kimi-k2.5 mit thinking={type:"enabled"} (Standard)
 *     → Reasoning, temperature fest 1.0
 *   - Kimi K2.5 Instant:  kimi-k2.5 mit thinking={type:"disabled"}
 *     → Schnell, kein Reasoning, temperature fest 0.6
 *   - Standard:  moonshot-v1-8k/32k/128k (freie temperature, legacy)
 *
 * Bei kimi-k2.5 dürfen temperature, top_p, n, presence_penalty und
 * frequency_penalty NICHT manuell gesetzt werden (API-Fehler!).
 *
 * Alle Modelle nutzen die OpenAI-kompatible API.
 * Dokumentation: https://platform.moonshot.ai/docs
 */

import { BaseAIProvider } from './base.js';

export class KimiProvider extends BaseAIProvider {
  constructor(config) {
    super('Kimi / Moonshot AI');
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.moonshot.ai/v1';
    this.model = config.model || 'kimi-k2.5';
    this.disableThinking = config.disableThinking || false;

    if (!this.apiKey) {
      console.warn('⚠️  KIMI_API_KEY nicht gesetzt! KI-Funktionen werden nicht verfügbar sein.');
    }
  }

  /**
   * Prüft ob das aktuelle Modell Kimi K2.5 ist.
   * K2.5 hat eigene Regeln: temperature/top_p sind fixiert,
   * Thinking wird über den `thinking`-Parameter gesteuert.
   */
  get isK25Model() {
    return /^kimi-k2\.5/i.test(this.model);
  }

  /**
   * Prüft ob das aktuelle Modell ein älteres Reasoning-Modell ist (kimi-k2, nicht k2.5).
   * Diese erzwingen temperature=1 und liefern `reasoning_content`.
   * Standard-Modelle (moonshot-v1-*) erlauben freie temperature.
   */
  get isReasoningModel() {
    return /^kimi-k/i.test(this.model) && !this.isK25Model;
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

    // K2.5: thinking-Parameter setzen, temperature NICHT setzen (fest durch API)
    if (this.isK25Model) {
      body.thinking = { type: this.disableThinking ? 'disabled' : 'enabled' };
    } else if (!this.isReasoningModel && options.temperature != null) {
      // Ältere Reasoning-Modelle (kimi-k2) erzwingen temperature=1
      // Standard-Modelle (moonshot-v1-*) erlauben freie temperature
      body.temperature = options.temperature;
    }
    if (options.json) body.response_format = { type: 'json_object' };

    console.log(`🌐 Kimi API chat → Modell: ${this.model}, Thinking: ${body.thinking?.type || 'n/a'}, JSON: ${!!options.json}, max_tokens: ${body.max_tokens}`);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000), // 2 Minuten Timeout
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API Fehler (${response.status}): ${error}`);
    }

    const data = await response.json();
    console.log(`✅ Kimi API chat ← Tokens: prompt=${data.usage?.prompt_tokens}, completion=${data.usage?.completion_tokens}`);
    const message = data.choices[0].message;
    // K2.5 und Standard-Modelle liefern `content`.
    // Ältere Reasoning-Modelle liefern ggf. `reasoning_content` statt `content`.
    if (message.content) return message.content;
    if (this.isReasoningModel) {
      if (!options.json && message.reasoning_content) return message.reasoning_content;
      throw new Error('Kimi hat keine verwertbare Antwort zurückgegeben (Reasoning-Modell). Bitte max_tokens erhöhen.');
    }
    throw new Error('Kimi hat keine Antwort zurückgegeben.');
  }

  /**
   * Sendet eine Chat-Anfrage mit einem einzelnen Bild (Vision)
   * Delegiert an chatWithImages für einheitliche Verarbeitung
   */
  async chatWithImage(prompt, imageBuffer, options = {}) {
    return this.chatWithImages(prompt, [imageBuffer], options);
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

    // K2.5: thinking-Parameter setzen, temperature NICHT setzen (fest durch API)
    if (this.isK25Model) {
      body.thinking = { type: this.disableThinking ? 'disabled' : 'enabled' };
    } else if (!this.isReasoningModel && options.temperature != null) {
      body.temperature = options.temperature;
    }
    if (options.json) body.response_format = { type: 'json_object' };

    console.log(`🌐 Kimi Vision API → Modell: ${this.model}, Thinking: ${body.thinking?.type || 'n/a'}, JSON: ${!!options.json}, Bilder: ${imageBuffers.length}, max_tokens: ${body.max_tokens}`);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000), // 5 Minuten Timeout für Vision (Thinking braucht länger)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi Vision API Fehler (${response.status}): ${error}`);
    }

    const data = await response.json();
    console.log(`✅ Kimi Vision API ← Tokens: prompt=${data.usage?.prompt_tokens}, completion=${data.usage?.completion_tokens}`);
    const message = data.choices[0].message;
    if (message.content) return message.content;
    if (this.isReasoningModel) {
      if (!options.json && message.reasoning_content) return message.reasoning_content;
      throw new Error('Kimi hat keine verwertbare Antwort zurückgegeben (Reasoning-Modell). Bitte max_tokens erhöhen.');
    }
    throw new Error('Kimi hat keine Antwort zurückgegeben.');
  }
}
