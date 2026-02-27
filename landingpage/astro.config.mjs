// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://langfeld.github.io',
  base: '/zauberjournal',
  integrations: [
    starlight({
      title: 'Zauberjournal Docs',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Deutsch', lang: 'de' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/langfeld/zauberjournal' },
      ],
      customCss: ['./src/styles/starlight-custom.css'],
      sidebar: [
        {
          label: 'Erste Schritte',
          items: [
            { label: 'Überblick', slug: 'docs/overview' },
            { label: 'Docker Setup', slug: 'docs/getting-started/docker' },
            { label: 'Umgebungsvariablen', slug: 'docs/getting-started/env-variables' },
            { label: 'Lokale Entwicklung', slug: 'docs/getting-started/local-development' },
            { label: 'Ersteinrichtung', slug: 'docs/getting-started/first-setup' },
            { label: 'Updates & CI/CD', slug: 'docs/getting-started/updating' },
          ],
        },
        {
          label: 'Features',
          items: [
            { label: 'Rezeptverwaltung', slug: 'docs/features/recipes' },
            { label: 'Wochenplaner', slug: 'docs/features/meal-planner' },
            { label: 'Einkaufsliste', slug: 'docs/features/shopping-list' },
            { label: 'Vorratsschrank', slug: 'docs/features/pantry' },
            { label: 'REWE-Integration', slug: 'docs/features/rewe-integration' },
            { label: 'Bring!-Integration', slug: 'docs/features/bring-integration' },
            { label: 'Admin-Bereich', slug: 'docs/features/admin' },
          ],
        },
        {
          label: 'Anleitungen',
          items: [
            { label: 'KI-Provider wechseln', slug: 'docs/guides/ai-providers' },
            { label: 'Export & Import', slug: 'docs/guides/export-import' },
          ],
        },
        {
          label: 'Referenz',
          items: [
            { label: 'REST-API', slug: 'docs/reference/api' },
            { label: 'Projektstruktur', slug: 'docs/reference/project-structure' },
            { label: 'CSS-Konventionen', slug: 'docs/reference/conventions' },
            { label: 'Sicherheit', slug: 'docs/reference/security' },
            { label: 'Einschränkungen', slug: 'docs/reference/known-limitations' },
          ],
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});