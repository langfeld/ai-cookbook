/**
 * ============================================
 * AI Provider - Abstraktionsschicht
 * ============================================
 *
 * Zentrale Factory für KI-Provider. Ermöglicht den einfachen
 * Wechsel zwischen verschiedenen AI-Backends (Kimi, OpenAI,
 * Anthropic, Ollama) über eine einheitliche Schnittstelle.
 *
 * NEUEN PROVIDER HINZUFÜGEN:
 * 1. Neue Datei unter services/ai/ erstellen (z.B. gemini.js)
 * 2. Klasse von BaseAIProvider ableiten
 * 3. In der providerMap unten registrieren
 * 4. Konfiguration in config/env.js ergänzen
 */

import { config } from '../../config/env.js';
import { KimiProvider } from './kimi.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';

// BaseAIProvider aus separater Datei re-exportieren (vermeidet zirkuläre Imports)
export { BaseAIProvider } from './base.js';

/**
 * Registry aller verfügbaren Provider
 * Zum Hinzufügen: einfach hier ergänzen
 */
const providerMap = {
  kimi: () => new KimiProvider(config.ai.kimi),
  openai: () => new OpenAIProvider(config.ai.openai),
  anthropic: () => new AnthropicProvider(config.ai.anthropic),
  ollama: () => new OllamaProvider(config.ai.ollama),
};

// Singleton-Instanz des aktiven Providers
let activeProvider = null;

/**
 * Gibt die aktive AI-Provider-Instanz zurück
 * Erstellt sie beim ersten Aufruf (Lazy Loading)
 */
export function getAIProvider() {
  if (!activeProvider) {
    const providerName = config.ai.provider;
    const factory = providerMap[providerName];

    if (!factory) {
      throw new Error(
        `Unbekannter AI-Provider: "${providerName}". ` +
        `Verfügbare Provider: ${Object.keys(providerMap).join(', ')}`
      );
    }

    activeProvider = factory();
    console.log(`🤖 AI-Provider geladen: ${activeProvider.name}`);
  }

  return activeProvider;
}

/**
 * Setzt den Provider zurück (z.B. nach Konfigurationsänderung)
 */
export function resetProvider() {
  activeProvider = null;
}
