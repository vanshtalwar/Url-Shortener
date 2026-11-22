#!/bin/sh
# Downloads MaxMind GeoLite2 City into backend/data/ (runs after `npm run build`).
# Needs MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY; without them it skips, and click locations are "Unknown".
set -eu
cd "$(dirname "$0")/.."

if [ -z "${MAXMIND_ACCOUNT_ID:-}" ] || [ -z "${MAXMIND_LICENSE_KEY:-}" ]; then
  echo "download-geoip: MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY not set, skipping (locations will be Unknown)"
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL -u "$MAXMIND_ACCOUNT_ID:$MAXMIND_LICENSE_KEY" \
  "https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz" -o "$tmp/db.tar.gz"
tar -xzf "$tmp/db.tar.gz" -C "$tmp"
mkdir -p data
mv "$(find "$tmp" -name 'GeoLite2-City.mmdb' | head -1)" data/GeoLite2-City.mmdb
echo "download-geoip: saved data/GeoLite2-City.mmdb"
