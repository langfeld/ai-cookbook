/**
 * ============================================
 * Anthropic Provider (Claude)
 * ============================================
 * Implementiert die KI-Anbindung an Anthropic Claude.
 * Verwendet die Anthropic Messages API.
 */

import { BaseAIProvider } from './base.js';

export class AnthropicProvider extends BaseAIProvider {
  constructor(config) {
    super('Anthropic Claude');
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.baseUrl = 'https://api.anthropic.com/v1';

    if (!this.apiKey) {
      console.warn('⚠️  ANTHROPIC_API_KEY nicht gesetzt!');
    }
  }

  async chat(prompt, options = {}) {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens ?? 4096,
        system:
          'Du bist ein hilfreicher Kochassistent. Du antwortest immer auf Deutsch und bist Experte für Rezepte, Zutaten, Kochtechniken und Wochenplanung.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API Fehler (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async chatWithImage(prompt, imageBuffer, options = {}) {
    const base64Image =
      imageBuffer instanceof Buffer
        ? imageBuffer.toString('base64')
        : imageBuffer;

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens ?? 4096,
        system:
          'Du bist ein hilfreicher Kochassistent. Analysiere Bilder von Rezepten und extrahiere alle relevanten Informationen. Antworte immer auf Deutsch.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image,
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic Vision Fehler (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }
}
