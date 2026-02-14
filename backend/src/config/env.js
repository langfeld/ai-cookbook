/**
 * ============================================
 * Umgebungsvariablen Konfiguration
 * ============================================
 * Zentrale Stelle für alle Environment-Variablen.
 * Defaults werden für die Entwicklung gesetzt.
 */

// Hilfsfunktion zum sicheren Lesen von Env-Vars
const getEnv = (key, defaultValue = '') => process.env[key] || defaultValue;

export const config = {
  // --- Allgemein ---
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: parseInt(getEnv('PORT', '3001'), 10),
  isDev: getEnv('NODE_ENV', 'development') === 'development',

  // --- JWT ---
  jwt: {
    secret: getEnv('JWT_SECRET', 'dev-secret-bitte-in-prod-aendern'),
    expiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
  },

  // --- AI Provider ---
  ai: {
    provider: getEnv('AI_PROVIDER', 'kimi'),
    kimi: {
      apiKey: getEnv('KIMI_API_KEY'),
      baseUrl: getEnv('KIMI_BASE_URL', 'https://api.moonshot.cn/v1'),
      model: getEnv('KIMI_MODEL', 'kimi-2.5'),
    },
    openai: {
      apiKey: getEnv('OPENAI_API_KEY'),
      model: getEnv('OPENAI_MODEL', 'gpt-4o'),
    },
    anthropic: {
      apiKey: getEnv('ANTHROPIC_API_KEY'),
      model: getEnv('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514'),
    },
    ollama: {
      baseUrl: getEnv('OLLAMA_BASE_URL', 'http://localhost:11434'),
      model: getEnv('OLLAMA_MODEL', 'llava'),
    },
  },

  // --- REWE ---
  rewe: {
    marketId: getEnv('REWE_MARKET_ID'),
    zipCode: getEnv('REWE_ZIP_CODE'),
  },

  // --- Datenbank ---
  database: {
    path: getEnv('DATABASE_PATH', './data/cookbook.db'),
  },

  // --- Upload ---
  upload: {
    maxSize: parseInt(getEnv('MAX_UPLOAD_SIZE', '10'), 10) * 1024 * 1024, // in Bytes
    path: getEnv('UPLOAD_PATH', './data/uploads'),
  },
};
