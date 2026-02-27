---
title: Ersteinrichtung
description: Den ersten Admin-Account anlegen und die App konfigurieren.
---

## Erster Start

Beim **ersten Start** existiert kein Administrator. Die App erkennt das automatisch:

1. Container starten (siehe [Docker Setup](/docs/getting-started/docker/))
2. Im Browser `http://localhost:8080` öffnen
3. Die Login-Seite zeigt einen **Setup-Hinweis** und das Registrierungsformular
4. **Den ersten Account registrieren** — dieser wird automatisch zum **Administrator**
5. In der Sidebar erscheint der **Admin-Bereich** (Shield-Icon)

## KI konfigurieren

6. **Admin → Einstellungen → KI-Konfiguration** → API-Key eintragen
7. KI-Provider wählen (Kimi, OpenAI, Anthropic oder Ollama)

→ Mehr dazu unter [KI-Provider wechseln](/docs/guides/ai-providers/)

## Optionale Einrichtung

8. **Registrierung deaktivieren** — wenn keine weiteren Benutzer hinzukommen sollen
9. **REWE-Integration** — standardmäßig aktiviert; Benutzer wählen ihren Markt selbst in den Einkaufslisten-Einstellungen
10. **Bring!-Integration** — jeder Benutzer verbindet sein eigenes Bring!-Konto

:::caution[Sicherheit]
Nur der allererste registrierte Account wird zum Admin. Alle weiteren Accounts erhalten die Rolle „Benutzer".
:::
