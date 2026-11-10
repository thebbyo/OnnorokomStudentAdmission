#!/usr/bin/env bash
# Bonus check: two backend processes (:8080 and :8081) share one database.
# Fires 60 simultaneous holds, alternating between them, at a 5-seat class.
# Expected output: exactly 5 x 201 and 55 x 409.
# Start with: docker compose --profile bonus up -d
set -euo pipefail
A="${A:-http://localhost:8080}"; B="${B:-http://localhost:8081}"
OUT="$(mktemp -d)"
CLASS=$(curl -s -X POST "$A/classes" -H 'Content-Type: application/json' \
  --data '{"name":"Two-process race","totalSeats":5}' | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "class $CLASS"
for n in $(seq 1 60); do
  if (( n % 2 == 0 )); then api=$A; else api=$B; fi
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "$api/classes/$CLASS/holds" \
    -H "X-Student-Id: $(printf '3%016d' "$n")" > "$OUT/$n" &
done
wait
cat "$OUT"/* | sort | uniq -c
curl -s "$A/classes/$CLASS"; echo
rm -rf "$OUT"
