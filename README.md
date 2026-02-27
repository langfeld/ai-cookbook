# Zauberjournal 🍳🤖

Eine KI-gestützte Rezeptverwaltung mit intelligentem Wochenplaner, Kochmodus, Einkaufsliste, REWE- & Bring!-Integration, Vorratsschrank und Admin-Bereich — Self-Hosted in einem Docker-Container.

![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?logo=docker&logoColor=white)
![Bring!](https://img.shields.io/badge/Bring!-Integration-4CAF50?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHRleHQgeT0iMTgiIGZvbnQtc2l6ZT0iMTgiPvCfm42uPC90ZXh0Pjwvc3ZnPg==&logoColor=white)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Userscript-00485B?logo=tampermonkey&logoColor=white)

---

<p align="center">
  <strong>KI-Rezeptimport</strong> · <strong>Wochenplaner</strong> · <strong>Einkaufsliste</strong> · <strong>REWE & Bring!</strong> · <strong>Vorratsschrank</strong> · <strong>Kochmodus</strong> · <strong>Backup & Export</strong>
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
