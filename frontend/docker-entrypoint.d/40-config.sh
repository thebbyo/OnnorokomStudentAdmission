#!/bin/sh
# Writes the runtime config read by index.html, so one image works with any backend URL.
set -eu
url="${API_BASE_URL:-http://localhost:8080}"
escaped=$(printf '%s' "$url" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf 'window.__CONFIG__ = { API_BASE_URL: "%s" };\n' "$escaped" > /usr/share/nginx/html/config.js
chmod 644 /usr/share/nginx/html/config.js
echo "config.js: API_BASE_URL=$url"
