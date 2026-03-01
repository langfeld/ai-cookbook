# Zauberjournal – E2E / Playwright MCP

Dieses Verzeichnis enthält die Playwright-MCP-Integration für das Zauberjournal-Projekt.

## Was ist Playwright MCP?

[Playwright MCP](https://github.com/anthropics/playwright-mcp) stellt Browser-Tools als MCP-Server bereit, die ein KI-Coding-Agent (z.B. GitHub Copilot) direkt nutzen kann – navigieren, klicken, Formulare ausfüllen, Screenshots machen, DOM inspizieren.

## Setup

### 1. Dependencies installieren

```bash
cd e2e
npm install
```

### 2. Browser installieren

```bash
npm run install:browsers
```

Dies installiert nur Chromium (~170 MB), nicht alle Browser.

### 3. MCP-Server in VS Code

Die Konfiguration liegt in `.vscode/mcp.json` und wird automatisch von VS Code erkannt. Der Playwright MCP-Server startet im **headed**-Modus (sichtbarer Browser) mit einer Viewport-Größe von 1280×720.

**Server starten**: In VS Code → Copilot Chat → der Playwright MCP-Server wird automatisch gestartet, wenn ein Tool aufgerufen wird.

## Nutzung

Im Copilot Chat (Agent-Modus) stehen folgende Playwright-Tools zur Verfügung:

| Tool | Beschreibung |
|---|---|
| `browser_navigate` | Zu einer URL navigieren |
| `browser_click` | Element anklicken |
| `browser_type` | Text in ein Feld eingeben |
| `browser_snapshot` | Accessibility-Snapshot der Seite |
| `browser_screenshot` | Screenshot erstellen |
| `browser_hover` | Über ein Element hovern |
| `browser_select_option` | Option in einem Dropdown wählen |
| `browser_wait` | Warten (z.B. auf Animationen) |
| `browser_go_back` / `browser_go_forward` | Vor/Zurück navigieren |
| `browser_press_key` | Tastendruck simulieren |
| `browser_tab_*` | Tab-Management |
| `browser_file_upload` | Datei hochladen |

### Beispiel-Prompts

- *"Navigiere zu http://localhost:5173 und mache einen Screenshot"*
- *"Logge dich als Admin ein und zeige mir das Dashboard"*
- *"Gehe zur Rezeptliste und prüfe ob die Suchfunktion funktioniert"*

## Ziel-URLs

| Modus | URL |
|---|---|
| **Development** | `http://localhost:5173` (Frontend) / `http://localhost:3001` (Backend API) |
| **Docker** | `http://localhost:8080` (alles über einen Port) |

## Projektstruktur

```
e2e/
├── package.json        # Dependencies (@playwright/mcp)
├── node_modules/       # (gitignored)
└── README.md           # Diese Datei
```
