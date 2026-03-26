# Zauberjournal 🍳🤖

Eine KI-gestützte Rezeptverwaltung mit intelligentem Wochenplaner, Kochmodus, Einkaufsliste, REWE- & Bring!-Integration, Vorratsschrank und Admin-Bereich — Self-Hosted in einem Docker-Container.

![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?logo=docker&logoColor=white)
![Offline-First](https://img.shields.io/badge/Offline--First-PWA_ready-FF6F00?logo=googlechrome&logoColor=white)
![Bring!](https://img.shields.io/badge/Bring!-Integration-4CAF50?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHRleHQgeT0iMTgiIGZvbnQtc2l6ZT0iMTgiPvCfm42uPC90ZXh0Pjwvc3ZnPg==&logoColor=white)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Userscript-00485B?logo=tampermonkey&logoColor=white)

---

## 🤖 KI-Features

Zauberjournal nutzt KI durchgängig im gesamten Workflow — vom Import über die Planung bis zum Vorratsmanagement:

| Feature | Beschreibung |
|---------|-------------|
| **KI-Rezeptimport** | Foto, Text oder URL → strukturiertes Rezept mit Zutaten, Schritten, Kategorien und Nährwerten |
| **KI-Überarbeitung** | Bestehende Rezepte per Freitext-Anweisung umschreiben lassen (Überschreiben oder Kopie) |
| **KI-Einkaufslisten-Check** | Automatische Prüfung auf fehlende Zutaten, Duplikate, Mengenlogik, Plausibilität und REWE-Zuordnungsfehler |
| **Intelligente Duplikat-Erkennung** | Synonyme, Singular/Plural, Schreibvarianten und Wortreihenfolge beim Generieren erkennen und zusammenführen |
| **KI-Vorratsabzug** | Beim Kochen erkennt die KI semantisch, welche Vorräte abgezogen werden — auch bei abweichenden Namen oder Einheiten |
| **KI-Vorrats-Transfer** | Beim Verschieben aus der Einkaufsliste normalisiert die KI Produktnamen, erkennt vorhandene Vorräte und weist Kategorien zu |
| **Nährwertschätzung** | Kalorien, Eiweiß, Kohlenhydrate und Fett pro Portion — automatisch geschätzt, manuell editierbar |
| **Wochenplan-Reasoning** | Optionale KI-Begründung, warum welches Rezept an welchem Tag eingeplant wurde |

Alle KI-Features sind **optional** und einzeln über Admin-Toggles aktivierbar. Zwischen **Thinking-** (gründlicher) und **Instant-Modus** (schneller) umschaltbar. Unterstützte Provider: Kimi, OpenAI, Anthropic, Ollama.

---

<p align="center">
  <strong>KI-Rezeptimport</strong> · <strong>KI-Einkaufslisten-Check</strong> · <strong>KI-Vorratsabzug</strong> · <strong>KI-Vorrats-Transfer</strong> · <strong>Nährwertschätzung</strong> · <strong>Wochenplaner</strong> · <strong>Einkaufsliste</strong> · <strong>REWE & Bring!</strong> · <strong>Vorratsschrank</strong> · <strong>Kochmodus</strong> · <strong>Offline-Modus</strong> · <strong>Haushalt-Sharing</strong> · <strong>Backup & Export</strong>
</p>

<p align="center">
  <img src="landingpage/public/screenshots/hero-dashboard.webp" alt="Zauberjournal Dashboard" width="800" />
</p>

---

## 🚀 Schnellstart

```yaml
services:
  zauberjournal:
    image: ghcr.io/langfeld/zauberjournal:latest
    container_name: zauberjournal
    restart: unless-stopped
    ports:
      - "8080:3001"
    volumes:
      - ./data:/app/data
    environment:
      - JWT_SECRET=CHANGE_ME    # openssl rand -base64 48
      - PUID=1000
      - PGID=1000
```

```bash
docker compose up -d
```

Erreichbar unter **http://localhost:8080** — der erste registrierte Account wird automatisch Admin.

---

## 🏠 Haushalt-Sharing (Multi-User)

Zauberjournal unterstützt **gemeinsame Nutzung** von Rezepten, Wochenplänen, Einkaufslisten und Vorratsschrank innerhalb eines Haushalts.

### Konzept

- **Haushalt erstellen**: Unter `/household` kann ein Haushalt angelegt werden
- **Einladen**: Per 8-stelligem Einladungscode (48h gültig) können andere Benutzer beitreten
- **Geteilte Daten**: Alle Mitglieder sehen Rezepte, Wochenpläne, Einkaufslisten, Vorratsschrank und Kategorien des Haushalts
- **Gleichberechtigt**: Alle Mitglieder haben volle Lese-/Schreibrechte
- **Datenmigration**: Bestehende persönliche Daten können per Klick in den Haushalt verschoben werden
- **Rezept-Link-Sharing**: Einzelne Rezepte können per Share-Link auch an Nicht-Mitglieder geteilt werden

### Echtzeit-Sync

Wenn ein Mitglied Änderungen vornimmt (Rezept erstellt, Einkaufsliste aktualisiert, etc.), werden alle anderen Haushaltsmitglieder in Echtzeit per **Server-Sent Events (SSE)** benachrichtigt.

### Admin-Einstellungen

| Setting | Standard | Beschreibung |
|---------|----------|--------------|
| `max_household_members` | 10 | Max. Mitglieder pro Haushalt |
| `max_households_per_user` | 3 | Max. Haushalte pro Benutzer |

---

## 📚 Links

| | |
|---|---|
| 🌐 **Website** | [langfeld.github.io/zauberjournal](https://langfeld.github.io/zauberjournal/) |
| 📖 **Dokumentation** | [langfeld.github.io/zauberjournal/docs](https://langfeld.github.io/zauberjournal/docs/overview/) |
| 🐳 **Docker Image** | [ghcr.io/langfeld/zauberjournal](https://ghcr.io/langfeld/zauberjournal) |
| 🐛 **Issues** | [GitHub Issues](https://github.com/langfeld/zauberjournal/issues) |

---

## 📜 Lizenz

MIT
