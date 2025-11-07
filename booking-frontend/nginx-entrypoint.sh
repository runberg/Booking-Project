#!/bin/sh
set -e

ORIGINAL_ENTRYPOINT="/docker-entrypoint.sh"

USE_INTERNAL_TRAEFIK=${USE_INTERNAL_TRAEFIK:-true}
TRAEFIK_PING_URL=${TRAEFIK_PING_URL:-http://proxy:8080/ping}
TRAEFIK_PING_RETRIES=${TRAEFIK_PING_RETRIES:-5}
TRAEFIK_PING_DELAY_SECONDS=${TRAEFIK_PING_DELAY_SECONDS:-2}
TRAEFIK_PING_TIMEOUT_MS=${TRAEFIK_PING_TIMEOUT_MS:-3000}

timeout_seconds=$(( (TRAEFIK_PING_TIMEOUT_MS + 999) / 1000 ))
if [ "$timeout_seconds" -le 0 ]; then
  timeout_seconds=3
fi

if [ "$USE_INTERNAL_TRAEFIK" != "true" ]; then
  echo "[traefik-check] USE_INTERNAL_TRAEFIK=false - verifying external Traefik at $TRAEFIK_PING_URL ..."

  attempt=1
  while [ $attempt -le $TRAEFIK_PING_RETRIES ]; do
    if wget --quiet --timeout=$timeout_seconds --tries=1 "$TRAEFIK_PING_URL" -O /dev/null 2>/dev/null; then
      echo "[traefik-check] External Traefik is reachable. Continuing startup."
      break
    fi

    if [ $attempt -ge $TRAEFIK_PING_RETRIES ]; then
      echo "[traefik-check] Could not verify external Traefik availability."
      echo "   - Current ping URL: $TRAEFIK_PING_URL"
      echo "   - Ensure this container shares the Traefik network and that /ping is enabled."
      echo "   - To fall back to the built-in proxy, set USE_INTERNAL_TRAEFIK=true"
      exit 1
    fi

    echo "[traefik-check] Attempt $attempt/$TRAEFIK_PING_RETRIES failed. Retrying in $TRAEFIK_PING_DELAY_SECONDS seconds..."
    attempt=$((attempt + 1))
    sleep "$TRAEFIK_PING_DELAY_SECONDS"
  done
fi

if [ -x "$ORIGINAL_ENTRYPOINT" ]; then
  exec "$ORIGINAL_ENTRYPOINT" "$@"
fi

exec "$@"

