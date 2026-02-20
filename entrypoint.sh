#!/bin/sh
# ============================================
# Zauberjournal — Entrypoint mit PUID/PGID-Support
# ============================================
# Passt den internen 'node'-User an die gewünschte
# UID/GID an, damit Volume-Dateien auf dem NAS
# dem richtigen Benutzer gehören.
#
# Standard:  PUID=1000, PGID=1000 (= node in Alpine)
# Synology:  PUID=1000, PGID=1000 (oder 568/568)
# QNAP:     PUID=1000, PGID=1000 (oder 500/500)

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Nur umschreiben, wenn sich UID/GID vom Default unterscheiden
CURRENT_UID=$(id -u node)
CURRENT_GID=$(id -g node)

if [ "$PUID" != "$CURRENT_UID" ] || [ "$PGID" != "$CURRENT_GID" ]; then
  echo "🔧 Passe Berechtigungen an: UID=$PUID, GID=$PGID"

  # GID in /etc/group direkt ändern (Alpine hat kein groupmod)
  sed -i "s/^node:x:${CURRENT_GID}:/node:x:${PGID}:/" /etc/group

  # UID + GID in /etc/passwd direkt ändern
  sed -i "s/^node:x:${CURRENT_UID}:${CURRENT_GID}:/node:x:${PUID}:${PGID}:/" /etc/passwd

  # Dateien im data-Verzeichnis anpassen
  chown -R "$PUID:$PGID" /app/data
fi

echo "👤 Starte als UID=$(id -u node), GID=$(id -g node)"

# Als node-User starten
exec su-exec node "$@"
