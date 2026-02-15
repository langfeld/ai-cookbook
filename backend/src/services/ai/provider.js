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

import { getAiConfig } from '../../config/settings.js';
import { KimiProvider } from './kimi.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';

// BaseAIProvider aus separater Datei re-exportieren (vermeidet zirkuläre Imports)
export { BaseAIProvider } from './base.js';

/**
 * Registry aller verfügbaren Provider
 * Config wird bei jedem Aufruf frisch aus der DB gelesen,
 * damit Änderungen im Admin-Panel sofort wirken.
 */
const providerMap = {
  kimi:      (ai) => new KimiProvider(ai.kimi),
  openai:    (ai) => new OpenAIProvider(ai.openai),
  anthropic: (ai) => new AnthropicProvider(ai.anthropic),
  ollama:    (ai) => new OllamaProvider(ai.ollama),
};

// Singleton-Instanz des aktiven Providers
let activeProvider = null;
let activeProviderName = null;

/**
 * Gibt die aktive AI-Provider-Instanz zurück.
 * Erstellt sie beim ersten Aufruf oder wenn sich der Provider geändert hat.
 */
export function getAIProvider() {
  const aiConfig = getAiConfig();
  const providerName = aiConfig.provider;

  // Provider neu erstellen, wenn sich die Auswahl geändert hat
  if (!activeProvider || activeProviderName !== providerName) {
    const factory = providerMap[providerName];

    if (!factory) {
      throw new Error(
        `Unbekannter AI-Provider: "${providerName}". ` +
        `Verfügbare Provider: ${Object.keys(providerMap).join(', ')}`
      );
    }

    activeProvider = factory(aiConfig);
    activeProviderName = providerName;
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
